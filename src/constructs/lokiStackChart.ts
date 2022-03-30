import { CfnOutput } from "aws-cdk-lib";
import { ICluster, ServiceAccount } from "aws-cdk-lib/aws-eks";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface LokiStackProps {
  readonly cluster: ICluster;
  readonly certificateArn: string;
  readonly lokiBucket: Bucket;
  readonly kubernetesNamespace: string;
  readonly route53Domain: string;
}

export class LokiStackChart extends Construct {
  constructor(scope: Construct, id: string, props: LokiStackProps) {
    super(scope, id);

    const grafanaDnsHostname = `grafana.${props.route53Domain}`;

    // Create Namespace
    const namespace = props.cluster.addManifest("createNamespace", {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: {
        name: props.kubernetesNamespace,
      },
    });

    // 🔑 Create Service Accounts / IAM roles for Kubernetes Services
    const lokiServiceAccount = new ServiceAccount(this, "LokiServiceAccount", {
      cluster: props.cluster,
      name: "loki-sa",
      namespace: props.kubernetesNamespace,
    });

    const grafanaServiceAccount = new ServiceAccount(this, "GrafanaServiceAccount", {
      cluster: props.cluster,
      name: "grafana-sa",
      namespace: props.kubernetesNamespace,
    });

    // ✅ Grant permissions to service accounts
    props.lokiBucket.grantReadWrite(lokiServiceAccount);

    grafanaServiceAccount.addToPrincipalPolicy(
      new PolicyStatement({
        sid: "CloudWatchReadOnlyAccess",
        actions: [
          "cloudwatch:List*",
          "cloudwatch:Get*",
          "cloudwatch:GetMetricStatistics",
          "autoscaling:Describe*",
          "logs:Get*",
          "logs:List*",
          "logs:StartQuery",
          "logs:StopQuery",
          "logs:Describe*",
          "logs:TestMetricFilter",
          "logs:FilterLogEvents",
          "sns:Get*",
          "sns:List*",
        ],
        resources: ["*"],
      })
    );
    grafanaServiceAccount.addToPrincipalPolicy(
      new PolicyStatement({
        sid: "AllowReadingTagsFromEC2",
        actions: ["ec2:DescribeTags", "ec2:DescribeInstances"],
        resources: ["*"],
      })
    );
    grafanaServiceAccount.addToPrincipalPolicy(
      new PolicyStatement({
        sid: "AllowCostExploring",
        actions: ["ce:GetReservationUtilization", "ce:GetDimensionValues", "ce:GetCostAndUsage", "ce:GetTags"],
        resources: ["*"],
      })
    );

    // https://github.com/grafana/helm-charts/blob/main/charts/loki/values.yaml
    const helmDeployment = props.cluster.addHelmChart("LokiStackHelmChart", {
      chart: "loki-stack",
      repository: "https://grafana.github.io/helm-charts",
      release: "loki-stack",
      namespace: props.kubernetesNamespace,
      // TODO: ❓ is there a nicer / cleaner way??? Can we use YAML in cdk helm deployment ❓
      values: {
        prometheus: {
          enabled: true,
        },
        promtail: {
          enabled: true,
        },
        loki: {
          enabled: true,
          replicas: 2,
          serviceAccount: {
            create: false,
            name: lokiServiceAccount.serviceAccountName,
          },
          config: {
            schema_config: {
              configs: [
                {
                  from: "2020-10-24",
                  store: "boltdb-shipper",
                  object_store: "s3",
                  schema: "v11",
                  index: {
                    prefix: "index_",
                    period: "24h",
                  },
                },
              ],
            },
            // https://grafana.com/docs/loki/latest/configuration/examples/
            storage_config: {
              boltdb_shipper: {
                active_index_directory: "/data/loki/index",
                cache_location: "/data/loki/index_cache",
                shared_store: "s3",
              },
              aws: {
                s3: `s3://${props.lokiBucket.env.region}/${props.lokiBucket.bucketName}`,
              },
            },
          },
        },
        grafana: {
          enabled: true,
          replicas: 2,
          serviceAccount: {
            create: false,
            name: grafanaServiceAccount.serviceAccountName,
          },
          imageRenderer: {
            enabled: true,
          },
          initChownData: {
            enabled: false,
          },
          persistence: {
            enabled: true,
            type: "pvc",
            accessModes: ["ReadWriteOnce"],
            storageClassName: "grafana",
            size: "10Gi",
            finalizers: ["kubernetes.io/pvc-protection"],
          },
          ingress: {
            enabled: true,
            hosts: [grafanaDnsHostname],
            // https://kubernetes-sigs.github.io/aws-load-balancer-controller/v1.1/guide/ingress/annotation/
            annotations: {
              "kubernetes.io/ingress.class": "alb",
              "alb.ingress.kubernetes.io/scheme": "internet-facing",
              "alb.ingress.kubernetes.io/target-type": "ip",
              "alb.ingress.kubernetes.io/success-codes": "200,302",
              "alb.ingress.kubernetes.io/listen-ports": '[{"HTTP": 80}, {"HTTPS": 443}]',
              "alb.ingress.kubernetes.io/ssl-redirect": "443",
              "alb.ingress.kubernetes.io/certificate-arn": props.certificateArn,
            },
          },
          service: {
            enabled: true,
            type: "NodePort",
          },
        },
      },
    });

    // ⏰ Wait for Kubernetes Namespace
    helmDeployment.node.addDependency(namespace);

    //=============================================================================================
    // 📄 Outputs 📄
    //=============================================================================================

    new CfnOutput(this, "Grafana-Url", {
      value: "https://" + grafanaDnsHostname,
    });
  }
}
