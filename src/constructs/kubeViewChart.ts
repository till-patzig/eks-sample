import { CfnOutput } from "aws-cdk-lib";
import { ICluster } from "aws-cdk-lib/aws-eks";
import { Construct } from "constructs";

export interface KubeViewProps {
  readonly cluster: ICluster;
  readonly hostAdress: string;
  readonly certificateArn: string;
}

export class KubeViewChart extends Construct {
  constructor(scope: Construct, id: string, props: KubeViewProps) {
    super(scope, id);

    // https://github.com/benc-uk/kubeview/blob/master/charts/kubeview/values.yaml
    props.cluster.addHelmChart("KubeView", {
      chart: "kubeview",
      repository: "https://kubeview.benco.io/charts/",
      release: "kubeview",
      namespace: "kube-system",
      values: {
        ingress: {
          enabled: true,
          hostname: props.hostAdress,
          hosts: [
            {
              host: props.hostAdress,
            },
          ],
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
    });

    //=============================================================================================
    // 📄 Outputs 📄
    //=============================================================================================

    new CfnOutput(this, "Kubeview-Url", {
      value: "https://" + props.hostAdress,
    });
  }
}
