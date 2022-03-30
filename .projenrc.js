const { awscdk } = require("projen");
const project = new awscdk.AwsCdkTypeScriptApp({
  repositoryUrl: "https://github.com/till-patzig/eks-sample",
  cdkVersion: "2.18.0",
  defaultReleaseBranch: "main",
  keywords: ["aws", "eks", "kubernetes", "grafana"],
  name: "EksSample",
  prettier: true,
  codeCov: true,
  minNodeVersion: "16.0.0",
  github: false,
});

project.prettier.settings.printWidth = 250;
project.synth();
