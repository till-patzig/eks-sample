import { ICluster, ServiceAccount } from "aws-cdk-lib/aws-eks";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface ExternalDnsProps {
  readonly cluster: ICluster;
  readonly hostedZoneId: string;
}

export class ExternalDnsChart extends Construct {
  constructor(scope: Construct, id: string, props: ExternalDnsProps) {
    super(scope, id);

    const serviceAccount = new ServiceAccount(this, "ServiceAccount", {
      cluster: props.cluster,
      namespace: "kube-system",
      name: "external-dns",
    });

    serviceAccount.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ["route53:ChangeResourceRecordSets", "route53:ListResourceRecordSets"],
        resources: [`arn:aws:route53:::hostedzone/${props.hostedZoneId}`],
      })
    );
    serviceAccount.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ["route53:ListHostedZones"],
        resources: ["*"],
      })
    );

    props.cluster.addHelmChart("ExternalDnsHelmChart", {
      chart: "external-dns",
      repository: "https://charts.bitnami.com/bitnami",
      release: "external-dns",
      namespace: "kube-system",
      values: {
        zoneIdFilters: [props.hostedZoneId],
        serviceAccount: {
          create: false,
          name: serviceAccount.serviceAccountName,
        },
      },
    });
  }
}
