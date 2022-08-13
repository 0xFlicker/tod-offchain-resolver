#!/usr/bin/env node

import * as cdk from "aws-cdk-lib";
import { jsonFromNodeModules, jsonFromSecret } from "./utils/files.js";

import { SopsStack } from "./sops.js";
import { ApiStack } from "./api.js";

const secretsJson = jsonFromSecret("deploy-secrets.json");

const app = new cdk.App();

new SopsStack(app, "Sops");
new ApiStack(app, "Api", {
  domain: ["ens", "0xflick.com"],
  rpcUrl: secretsJson.rpcUrl,
  contractMappings: JSON.stringify(secretsJson.contractMappings),
  privateKey: secretsJson.privateKey,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
});
