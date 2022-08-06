import * as cdk from "aws-cdk-lib";
import * as kms from "aws-cdk-lib/aws-kms";
import * as iam from "aws-cdk-lib/aws-iam";

export class SopsStack extends cdk.Stack {
  constructor(scope: cdk.Stage, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // The SOPS user to encrypt / decrypt secrets
    const sopsUser = new iam.User(this, "SopsUser", {
      userName: "offchain-resolver.kms.user",
    });
    const accessKey = new iam.AccessKey(this, "SopsUserAccessKey", {
      user: sopsUser,
    });
    const accessKeyRole = new iam.Role(this, "SopsUserAccessKeyRole", {
      assumedBy: new iam.CompositePrincipal(
        sopsUser,
        iam.User.fromUserName(this, "AdminUser", "admin"),
        iam.User.fromUserName(this, "InfraUser", "infra")
      ),
    });
    const kmsKey = new kms.Key(this, "SopsKmsKey", {
      description: "SOPS KMS Key",
      enableKeyRotation: true,
    });

    kmsKey.grantEncryptDecrypt(accessKeyRole);

    new cdk.CfnOutput(this, "AccessKey", {
      value: accessKey.accessKeyId,
    });
    new cdk.CfnOutput(this, "AccessSecret", {
      value: accessKey.secretAccessKey.unsafeUnwrap(),
    });
    new cdk.CfnOutput(this, "SopsKmsKeyArn", {
      value: kmsKey.keyArn,
    });
    new cdk.CfnOutput(this, "SopsKmsRole", {
      value: accessKeyRole.roleArn,
    });
  }
}
