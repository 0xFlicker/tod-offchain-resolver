require("dotenv/config");
const { task } = require("hardhat/config");

require("@nomiclabs/hardhat-etherscan");
require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-waffle');
require('@typechain/hardhat');
require('hardhat-deploy');
require('hardhat-deploy-ethers');

let real_accounts = undefined;
if (process.env.DEPLOYER_KEY && process.env.OWNER_KEY) {
  console.log("Using deployer and owner keys from environment variables");
  real_accounts = [process.env.OWNER_KEY, process.env.DEPLOYER_KEY];
}
const gatewayurl = "https://offchain-resolver-example.uc.r.appspot.com/{sender}/{data}.json"
/**
 * @type import('hardhat/config').HardhatUserConfig
 */

module.exports = {
  solidity: "0.8.10",
  networks: {
    hardhat: {
      throwOnCallFailures: false,
      chainId: 1337,
      gatewayurl: 'https://ens.0xflick.com/{sender}/{data}',
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${process.env.INFURA_ID}`,
      tags: ["test", "demo"],
      chainId: 3,
      accounts: real_accounts,
      gatewayurl,
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_ID}`,
      tags: ["test", "demo"],
      chainId: 4,
      accounts: real_accounts,
      gatewayurl,
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_ID}`,
      tags: ["test", "demo"],
      chainId: 5,
      accounts: real_accounts,
      gatewayurl,
    },
    mainnet: {
      url: `http://borg.local:8545`,
      tags: ["demo"],
      chainId: 1,
      accounts: real_accounts,
      gatewayurl: 'https://ens.0xflick.com/{sender}/{data}'
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  namedAccounts: {
    signer: {
      default: '0xcbC456BcE65a8D5c7C77B8A952FCe051CfC2DB8B',
    },
    deployer: {
      default: 1,
    },
  },
  typechain: {
    outDir: "../lambda/src/typechain",
    target: "ethers-v5",
  },
};
