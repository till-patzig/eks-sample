import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import { InstanceType, Vpc } from "aws-cdk-lib/aws-ec2";
import { AlbController, AlbControllerVersion, Cluster, CoreDnsComputeType, DefaultCapacityType, KubernetesVersion } from "aws-cdk-lib/aws-eks";
import { AccountRootPrincipal, Policy, PolicyDocument, PolicyStatement, Role, User } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { ClusterScalerDnsChart } from "../constructs/clusterAutoScalerChart";
import { EfsDriverChart } from "../constructs/efsDriverChart";
import { ExternalDnsChart } from "../constructs/externalDnsChart";
import { KubeViewChart } from "../constructs/kubeViewChart";
import { LokiStackChart } from "../constructs/lokiStackChart";
import { StorageStack } from "./storageStack";

interface EksEc2ClusterStackProps extends StackProps {
  readonly adminUsers: string[];
  readonly vpc: Vpc;
  readonly defaultCapacityInstance: InstanceType;
  readonly hostenZoneID: string;
  readonly awsRegion: string;
  readonly certificateArn: string;
  readonly maxEc2Count: number;
  readonly storageStack: StorageStack;
  readonly route53Domain: string;
}

export class EksEc2ClusterStack extends Stack {
  public readonly cluster: Cluster;

  constructor(scope: Construct, id: string, props: EksEc2ClusterStackProps) {
    super(scope, id, props);

    // 🔑 Create masters role for EKS cluster
    const mastersRole = new Role(this, "IAM-MastersRole", {
      assumedBy: new AccountRootPrincipal(),
    });

    // 👇 Create EKS cluster with EC2 worker nodes 💻
    this.cluster = new Cluster(this, "Ec2Cluster", {
      vpc: props.vpc,
      mastersRole,
      version: KubernetesVersion.V1_21,
      coreDnsComputeType: CoreDnsComputeType.EC2,
      defaultCapacityInstance: props.defaultCapacityInstance,
      defaultCapacityType: DefaultCapacityType.EC2,
      defaultCapacity: 0,
    });

    // 🔑 Add mappings to Kubernetes groups (required for AWS Console "EKS")
    for (let user of props.adminUsers) {
      this.cluster.awsAuth.addUserMapping(User.fromUserName(this, user, user), {
        groups: ["system:bootstrappers", "system:nodes", "system:masters"],
      });
    }

    // 👇 Extend EKS Creator Role (otherwise you´ll get errors in AWS Management Console 💥)
    // https://docs.aws.amazon.com/eks/latest/userguide/security_iam_id-based-policy-examples.html
    let roleNameForCfnOutput: string = "undefined!";
    if (this.cluster.kubectlRole) {
      roleNameForCfnOutput = this.cluster.kubectlRole?.roleName;

      // TODO: 🚧 least priviledge
      this.cluster.kubectlRole.attachInlinePolicy(
        new Policy(this, "Allow_IAM_EKS_All", {
          statements: [
            new PolicyStatement({
              actions: ["iam:*", "eks:*", "ec2:*"],
              resources: ["*"],
            }),
          ],
        })
      );
    }

    // 💻 Create a custom node group
    const nodegroup = this.cluster.addNodegroupCapacity("eksNodeGroup", {
      instanceTypes: [props.defaultCapacityInstance],
      maxSize: props.maxEc2Count,
    });
    nodegroup.role.attachInlinePolicy(
      new Policy(this, "NodeGroupInlinePolicy", {
        document: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ["elasticfilesystem:*", "ec2:*"],
              // TODO: 🚧 Least privilege
              resources: [`*`],
            }),
          ],
        }),
      })
    );

    // 💻 Deploy cluster-autoscaler
    const clusterScaler = new ClusterScalerDnsChart(this, "clusterScaler", {
      cluster: this.cluster,
      nodegroups: [nodegroup],
      awsRegion: props.awsRegion,
    });
    clusterScaler.node.addDependency(nodegroup);

    // 💾 Deploy EFS Storage Driver
    const efsDriver = new EfsDriverChart(this, "efsDriver", {
      cluster: this.cluster,
      efs: props.storageStack.efs,
      nodegroup,
      namespace: "kube-system",
    });
    efsDriver.node.addDependency(clusterScaler);

    // 👇 Add Load Balancer Controller to EC2 cluster
    const albController = new AlbController(this, "Alb", {
      cluster: this.cluster,
      version: AlbControllerVersion.V2_3_1,
    });
    albController.node.addDependency(clusterScaler);

    // 📈 Deploy KubeView dashbaord to default namespace
    const kubeView = new KubeViewChart(this, "kubeView", {
      cluster: this.cluster,
      hostAdress: `kubeview.${props.route53Domain}`,
      certificateArn: props.certificateArn,
    });
    kubeView.node.addDependency(clusterScaler);

    // 🌍 Deploy externa-dns to default namespace
    const externalDns = new ExternalDnsChart(this, "externalDns", {
      cluster: this.cluster,
      hostedZoneId: props.hostenZoneID,
    });
    externalDns.node.addDependency(clusterScaler);

    // 🎁 Deploy loki-stack HELM chart to EKS cluster
    const lokiStack = new LokiStackChart(this, "lokiStackChart", {
      cluster: this.cluster,
      lokiBucket: props.storageStack.lokiBucket,
      route53Domain: props.route53Domain,
      certificateArn: props.certificateArn,
      kubernetesNamespace: "grafana",
    });

    // ⏰ Wait for required Kubernetes support services
    lokiStack.node.addDependency(externalDns);
    lokiStack.node.addDependency(albController);
    lokiStack.node.addDependency(efsDriver);

    //=============================================================================================
    // 📄 Outputs 📄
    //=============================================================================================

    new CfnOutput(this, "MastersRole", {
      value: roleNameForCfnOutput,
      description: "Assume this role for accessing EKS cluster via AWS Management Console!",
    });
    new CfnOutput(this, "AdminUserList", {
      value: props.adminUsers.toString(),
      description: "Users having full access in AWS Management Console -> EKS",
    });

    
  }
}
