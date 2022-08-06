import { fileURLToPath } from "url";
import path from "path";
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cr from "aws-cdk-lib/custom-resources";
import { HttpLambdaIntegration } from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import {
  CorsHttpMethod,
  HttpApi,
  HttpMethod
} from "@aws-cdk/aws-apigatewayv2-alpha";
import { Cors } from "aws-cdk-lib/aws-apigateway";

export interface ImageProps extends cdk.StackProps {
  readonly domain: [string, string] | string;
  readonly privateKey: string;
  readonly rpcUrl: string;
  readonly contractMappings: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  constructor(scope: cdk.Stage, id: string, props: ImageProps) {
    const { domain, contractMappings, privateKey, rpcUrl, ...rest } = props;
    super(scope, id, rest);

    // Domain
    const domains = domain instanceof Array ? domain : [domain];
    const domainName = domains.join(".");
    const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
      domainName: domain.length === 2 ? domains[1] : domains[0]
    });

    const certificate = new acm.DnsValidatedCertificate(this, "certificate", {
      domainName,
      hostedZone: hostedZone
    });

    // Params
    const privateKeyParam = new ssm.StringParameter(
      this,
      "resolver-private-key",
      {
        description: "The private key for signing",
        parameterName: "/offchain-ens-resolver/PrivateKey",
        stringValue: privateKey,
        tier: ssm.ParameterTier.STANDARD
      }
    );
    const rpcParam = new ssm.StringParameter(this, "resolver-rpc", {
      description: "The rpc",
      parameterName: "/offchain-ens-resolver/RpcUrl",
      stringValue: rpcUrl,
      tier: ssm.ParameterTier.STANDARD
    });

    const contractMappingsParam = new ssm.StringParameter(
      this,
      "resolver-contract-mappings",
      {
        description: "The rpc",
        parameterName: "/offchain-ens-resolver/ContractMappings",
        stringValue: contractMappings,
        tier: ssm.ParameterTier.STANDARD
      }
    );

    const ensResolver = new lambda.Function(this, "ENS-Resolver", {
      runtime: lambda.Runtime.NODEJS_16_X,
      code: lambda.Code.fromAsset(path.join(__dirname, "../.layers/lambda")),
      handler: "index.handler",
      timeout: cdk.Duration.seconds(20),
      memorySize: 256
    });
    privateKeyParam.grantRead(ensResolver);
    rpcParam.grantRead(ensResolver);
    contractMappingsParam.grantRead(ensResolver);

    const httpApi = new apigateway.RestApi(this, "Api", {});
    httpApi.addDomainName("domain", {
      domainName,
      certificate
    });
    const senderResource = httpApi.root.addResource("{sender}");
    const callDataResource = senderResource.addResource("{callData}");
    callDataResource.addCorsPreflight({
      allowOrigins: Cors.ALL_ORIGINS,
      allowMethods: Cors.ALL_METHODS
    });
    callDataResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(ensResolver)
    );
    callDataResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(ensResolver)
    );

    new cdk.CfnOutput(this, "httpApi", {
      value: httpApi.url
    });

    new route53.ARecord(this, "CustomDomainAliasRecord", {
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(
        new targets.ApiGatewayDomain(httpApi.domainName as any)
      ),
      recordName: domainName
    });
  }
}
