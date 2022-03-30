import { FileSystem } from "aws-cdk-lib/aws-efs";
import { ICluster, Nodegroup, ServiceAccount } from "aws-cdk-lib/aws-eks";
import { Construct } from "constructs";

export interface EfsDriverProps {
  readonly cluster: ICluster;
  readonly nodegroup: Nodegroup;
  readonly efs: FileSystem;
  readonly namespace: string;
}

export class EfsDriverChart extends Construct {
  constructor(scope: Construct, id: string, props: EfsDriverProps) {
    super(scope, id);

    // 🔑 Create Service Account
    const serviceAccount = new ServiceAccount(this, "ServiceAccount", {
      cluster: props.cluster,
      name: "efs-driver",
      namespace: props.namespace,
    });

    // ✅ Grant service account access to EFS File System
    props.efs.grant(serviceAccount, "elasticfilesystem:*");

    // ✅ Add Allow Statement for all to EFS Security Group
    // TODO: 🚧 replace with security group of EKS cluster nodes
    // TEST it -> props.efs.connections.allowDefaultPortFrom(props.cluster);
    props.efs.connections.allowDefaultPortFromAnyIpv4();

    // https://github.com/kubernetes-sigs/aws-efs-csi-driver/blob/release-1.3/charts/aws-efs-csi-driver/values.yaml
    const helmDeployment = props.cluster.addHelmChart("efs-driver", {
      chart: "aws-efs-csi-driver",
      repository: "https://kubernetes-sigs.github.io/aws-efs-csi-driver/",
      release: "aws-efs-csi-driver",
      namespace: props.namespace,
      values: {
        controller: {
          serviceAccount: {
            create: false,
            name: serviceAccount.serviceAccountName,
          },
        },
        storageClasses: [
          {
            name: "grafana",
            annotations: {
              "storageclass.kubernetes.io/is-default-class": "false",
            },
            parameters: {
              provisioningMode: "efs-ap",
              fileSystemId: props.efs.fileSystemId,
              directoryPerms: "777", // 700 is default -> results in undefined error in grafana init container 💥
              gidRangeStart: "1000",
              gidRangeEnd: "2000",
              basePath: "/grafana",
            },
          },
          {
            name: "prometheus",
            annotations: {
              "storageclass.kubernetes.io/is-default-class": "false",
            },
            parameters: {
              provisioningMode: "efs-ap",
              fileSystemId: props.efs.fileSystemId,
              directoryPerms: "777", // 700 is default -> results in undefined error in grafana init container 💥
              gidRangeStart: "1000",
              gidRangeEnd: "2000",
              basePath: "/prometheus",
            },
          },
        ],
      },
    });
    helmDeployment.node.addDependency(serviceAccount);
  }
}
