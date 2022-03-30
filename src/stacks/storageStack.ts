import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Vpc } from "aws-cdk-lib/aws-ec2";
import { CfnFileSystem, FileSystem, PerformanceMode } from "aws-cdk-lib/aws-efs";
import { Bucket, BlockPublicAccess } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

interface StorageStackProps extends StackProps {
  readonly vpc: Vpc;
}
export class StorageStack extends Stack {
  public readonly lokiBucket: Bucket;
  public readonly efs: FileSystem;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    // 💾 create s3 bucket for loki
    this.lokiBucket = new Bucket(this, "lokiBucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true, // 📍 required to delete and destroy bucket
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // 📂 Create EFS FileSystem
    this.efs = new FileSystem(this, "efsFileSystem", {
      vpc: props.vpc,
      removalPolicy: RemovalPolicy.DESTROY, // TODO: 🚧 add deletion protection before going to prod!
      performanceMode: PerformanceMode.GENERAL_PURPOSE,
    });

    // 	🚩 JUST IN TEST MODE FOR FUTHER INVESTIGATION!
    // 💾 Enable backups
    const efsCfn: CfnFileSystem = this.efs.node.defaultChild as CfnFileSystem;
    efsCfn.backupPolicy = { status: "ENABLED" };
  }
}
