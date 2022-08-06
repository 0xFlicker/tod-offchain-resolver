import { Command } from 'commander';
import ethers from 'ethers';

const program = new Command();
program
  .option('-r --registry <address>', 'ENS registry address')
  .option('-p --provider <url>', 'web3 provider URL', 'http://localhost:8545/')
  .option('-i --chainId <chainId>', 'chainId', '1337')
  .option('-n --chainName <name>', 'chainName', 'unknown')
  .argument('<name>');

program.parse(process.argv);
const options = program.opts();
const provider = new ethers.providers.JsonRpcProvider(options.provider);
(async () => {
  const name = program.args[0];
  let resolver = await provider.getResolver(name);
  if (resolver) {
    let ethAddress = await resolver.getAddress();
    let email = await resolver.getText('email');
    let contentHash = await resolver.getContentHash();
    console.log(`resolver address ${resolver.address}`);
    console.log(`eth address ${ethAddress}`);
    console.log(`email ${email}`);
    console.log(`contentHash ${contentHash}`);
  } else {
    console.log('no resolver found');
  }
})();
