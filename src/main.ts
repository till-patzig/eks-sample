import { App } from "aws-cdk-lib";
import { EksEc2ClusterStack } from "./stacks/eksEc2Cluster";
import { StorageStack } from "./stacks/storageStack";
import { AdminUsers, AwsAccount, AwsRegion, ClusterInstanceNodeType, MaxEc2Count, Route53Domain, Route53HostedZoneId, TlsCertificateARN } from "./config/eksSampleConfig";
import { SampleVpcStack } from "./stacks/sampleVpc";
import { emptyClusterPermissionDemoStack } from "./stacks/emptyClusterPermissionDemo";

const env = {
  account: AwsAccount,
  region: AwsRegion,
};

const app = new App();

const vpcStack = new SampleVpcStack(app, "vpc-stack", { env, description: "vpc for eks sample" });

const storageStack = new StorageStack(app, "eks-storage", {
  env,
  description: "storage for eks sample",
  terminationProtection: true,
  vpc: vpcStack.vpc,
});
storageStack.node.addDependency(vpcStack);

const emptyClusterForbidden = new emptyClusterPermissionDemoStack(app, "empty-eks-cluster-forbidden", {
  env,
  description: "demonstration of insufficient rights in EKS menu",
  vpc: vpcStack.vpc,
  iamUserName: "till",
  grantPermission: false,
});
emptyClusterForbidden.node.addDependency(vpcStack);

const eksCluster = new EksEc2ClusterStack(app, "eks-sample", {
  env,
  description: "EKS sample cluster with autoscaled EC2 worker nodes. Deployed services: aws-autoscaler, external-dns, aws-alb-controller, aws-efs-storage, kubeview, grafana-stack",
  vpc: vpcStack.vpc,
  adminUsers: AdminUsers,
  hostenZoneID: Route53HostedZoneId,
  route53Domain: Route53Domain,
  certificateArn: TlsCertificateARN,
  maxEc2Count: MaxEc2Count,
  defaultCapacityInstance: ClusterInstanceNodeType,
  awsRegion: AwsRegion,
  storageStack,
});
eksCluster.node.addDependency(storageStack);

app.synth();
