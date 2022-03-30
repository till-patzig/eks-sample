import { Stack, StackProps } from "aws-cdk-lib";
import { InstanceClass, InstanceSize, InstanceType, Vpc } from "aws-cdk-lib/aws-ec2";
import { Cluster, CoreDnsComputeType, DefaultCapacityType, KubernetesVersion } from "aws-cdk-lib/aws-eks";
import { Policy, PolicyStatement, User } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

interface emptyClusterPermissionDemoStackProps extends StackProps {
  readonly vpc: Vpc;
  readonly grantPermission: boolean;
  readonly iamUserName: string;
}

export class emptyClusterPermissionDemoStack extends Stack {
  constructor(scope: Construct, id: string, props: emptyClusterPermissionDemoStackProps) {
    super(scope, id, props);

    // ❌ Create EKS for demonstration of missing permissions in AWS Management Console
    const cluster = new Cluster(this, "EmptyEc2Cluster", {
      vpc: props.vpc,
      version: KubernetesVersion.V1_21,
      coreDnsComputeType: CoreDnsComputeType.EC2,
      defaultCapacityInstance: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
      defaultCapacityType: DefaultCapacityType.EC2,
      defaultCapacity: 0,
    });

    if (props.grantPermission) {
      // 🔑 Add mappings to Kubernetes groups (required for AWS Console "EKS")
      cluster.awsAuth.addUserMapping(User.fromUserName(this, props.iamUserName, props.iamUserName), {
        groups: ["system:bootstrappers", "system:nodes", "system:masters"],
      });

      // 👇 Extend EKS Creator Role (otherwise you´ll get errors in AWS Management Console 💥)
      // https://docs.aws.amazon.com/eks/latest/userguide/security_iam_id-based-policy-examples.html
      if (cluster.kubectlRole) {
        // TODO: 🚧 least priviledge
        cluster.kubectlRole.attachInlinePolicy(
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
    }
  }
}
