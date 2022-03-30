# Open tasks
- [ ] **implement least privilege in all policies**
- [ ] implement job for patching the ec2 worker nodes 
- [ ] create backup job for EFS file system
- [ ] publish service endpoints
  - [ ] find solution for full automated cluster termination *(when destroying stack `eks-sample` there are resources like load balancers and r53 records left, that need to be deleted manually)* 💩
  - [ ] add sample implementation for nginx ingress (replacement for ALB controller)
- [ ] add cdk infrastructure tests

# How to use this repo
## Deployment
1. edit config file `/src/config/eksSampleConfig.ts` and replace with values from your environment
1. run `yarn` for resolving dependencies
1. run `cdk deploy --all` for deploying the cloudformation stacks

## Use the deployed components
1. Run `Ec2ClusterConfigCommand`found in cloudformation stack `eks-sample` for updating kubectl-config 
1. Get Grafana Admin Password `kubectl -n grafana get secret loki-stack-grafana -o jsonpath="{.data.admin-password}" | base64 -d;echo`
1. Browse Urls found in output parameters of cloudformation stack `eks-sample`
   - Grafana
   - Kubeview

## kubectl commands
|                                  |command                                                                                                               |
|--                                |--                                                                                                                    |
|get Grafana Admin password        |`kubectl -n grafana get secret loki-stack-grafana -o jsonpath="{.data.admin-password}" | base64 -d;echo`              |
|get Loki configuration            |`kubectl -n grafana get secret loki-stack -o json | jq '.data."loki.yaml"' | tr -d "\"" | base64 -d`                  |
|get all services in Grafana space |`kubectl -n grafana get services`                                                                                     |
|get all pods in Grafana space     |`kubectl -n grafana get pods`                                                                                         |
|get loki logs                     |`kubectl -n grafana logs loki-stack-0`                                                                                |
|:floppy_disk: get storage classes |`kubectl get storageclass`                                                                                            |
|:floppy_disk: get storage         |`kubectl -n grafana get pvc`                                                                                          |
|:newspaper: get events            |`kubectl -n grafana get events`                                                                                       |
|:x: delete all from namespace     |`kubectl delete ns grafana`                                                                                           |                                                                                                             |
|describe promtail                 |`kubectl -n grafana describe daemonset.apps/loki-stack-promtail`                                                      |
|configmap loki-stack              |`kubectl -n grafana describe configmaps loki-stack`                                                                   |
|configmap grafana                 |`kubectl -n grafana describe configmaps loki-stack-grafana`                                                           |
|configmap prometheus-alertmanager |`kubectl -n grafana describe configmaps loki-stack-prometheus-alertmanager`                                           |
|configmap prometheus-server       |`kubectl -n grafana describe configmaps loki-stack-prometheus-server`                                                 |
|configmap promtail                |`kubectl -n grafana describe configmaps loki-stack-promtail`                                                          |
|connecto to bash from pod. example|`kubectl -n grafana exec -it loki-stack-prometheus-server-57f5459f7c-h7fvb -- sh` |
|get prometheus-server logs        |`kubectl -n grafana logs loki-stack-prometheus-server-57f5459f7c-h7fvb prometheus-server`|