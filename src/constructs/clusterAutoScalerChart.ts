import { CfnJson } from "aws-cdk-lib";
import { Cluster, Nodegroup, ServiceAccount } from "aws-cdk-lib/aws-eks";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface ClusterScalerProps {
  readonly cluster: Cluster;
  readonly nodegroups: Nodegroup[];
  readonly awsRegion: string;
}

export class ClusterScalerDnsChart extends Construct {
  constructor(scope: Construct, id: string, props: ClusterScalerProps) {
    super(scope, id);

    const serviceAccount = new ServiceAccount(this, "ServiceAccount", {
      cluster: props.cluster,
      name: "auto-scaler",
      namespace: "kube-system",
    });

    serviceAccount.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ["autoscaling:DescribeAutoScalingGroups", "autoscaling:DescribeAutoScalingInstances", "autoscaling:DescribeLaunchConfigurations", "autoscaling:DescribeTags", "ec2:Describe*"],
        resources: [`*`],
      })
    );

    const autoscalingGroupARNs: string[] = [];
    props.nodegroups.forEach((item) => {
      autoscalingGroupARNs.push(`arn:aws:autoscaling:${item.env.region}:${item.env.account}:autoScalingGroup:*`);
    });

    const stringEqualsCondition = new CfnJson(this, "ConditionJson", {
      value: {
        [`autoscaling:ResourceTag/kubernetes.io/cluster/${props.cluster.clusterName}`]: "owned",
        "autoscaling:ResourceTag/k8s.io/cluster-autoscaler/enabled": "true",
      },
    });

    serviceAccount.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ["autoscaling:SetDesiredCapacity", "autoscaling:TerminateInstanceInAutoScalingGroup", "autoscaling:UpdateAutoScalingGroup"],
        resources: autoscalingGroupARNs,
        conditions: {
          StringEquals: stringEqualsCondition,
        },
      })
    );

    props.cluster.addHelmChart("cluster-autoscaler", {
      chart: "cluster-autoscaler",
      repository: "https://kubernetes.github.io/autoscaler",
      release: "cluster-autoscaler",
      namespace: "kube-system",
      // https://github.com/kubernetes/autoscaler/blob/master/charts/cluster-autoscaler/values.yaml
      values: {
        awsRegion: props.awsRegion,
        autoDiscovery: {
          clusterName: props.cluster.clusterName,
        },
        rbac: {
          serviceAccount: {
            create: false,
            name: serviceAccount.serviceAccountName,
          },
        },
      },
    });
  }
}
