const { ethers } = require("hardhat");

module.exports = async ({ getNamedAccounts, getUnnamedAccounts, deployments, network }) => {
  const { deploy } = deployments;
  const { signer } = await getNamedAccounts();
  const [deployer] = await getUnnamedAccounts();
  console.log(`deployer: ${deployer}`);
  console.log(`signer: ${signer}`);
  if (!network.config.gatewayurl) {
    throw ("gatewayurl is missing on hardhat.config.js");
  }
  await deploy('OffchainResolver', {
    from: deployer,
    args: [network.config.gatewayurl, [signer]],
    log: true,
  });
};
module.exports.tags = ['test', 'demo'];
