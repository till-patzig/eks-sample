import { InstanceClass, InstanceSize, InstanceType } from "aws-cdk-lib/aws-ec2";

// 👇 replace with values from your environment ❗
export const AwsAccount = "919143489464";
export const AwsRegion = "eu-central-1";
export const Route53HostedZoneId = "Z1045551XTXF28M0E420";
export const Route53Domain = "till-patzig.io";
export const TlsCertificateARN = "arn:aws:acm:eu-central-1:919143489464:certificate/a2bb4d0d-02b8-4529-adc1-9665d20d27ec";
export const AdminUsers = ["till"];
// ☝️ replace with values from your environment ❗

export const ClusterInstanceNodeType = InstanceType.of(InstanceClass.T2, InstanceSize.MEDIUM);
export const MaxEc2Count = 10;
