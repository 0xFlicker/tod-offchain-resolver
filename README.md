# ENS Offchain Resolver

This repository contains smart contracts and a node.js lambda that together allow hosting ENS names offchain using [EIP 3668](https://eips.ethereum.org/EIPS/eip-3668) and [ENSIP 10](https://docs.ens.domains/ens-improvement-proposals/ensip-10-wildcard-resolution).

This works well with modern and full ENS compliant clients, such as ethers.js. Support elsewhere is mixed. As of this writing etherscan.io will correct attempt to resolve sub-domains using the user's browser, but do not try to resolve domains. MetaMask has merged PRs but yet released. Keep an eye out for Mobile 5.6 and Desktop 10.19.

## Overview

ENS resolution requests to the resolver implemented in this repository are responded to with a directive to query a gateway server for the answer. The gateway server generates and signs a response, which is sent back to the original resolver for decoding and verification. Full details of this request flow can be found in EIP 3668.

All of this happens transparently in supported clients (such as ethers.js with the ethers-ccip-read-provider plugin, or future versions of ethers.js which will have this functionality built-in).

## [lambda](packages/lambda)

The lambda implements CCIP Read (EIP 3668), and answers requests by looking up the names in SSM parameter. The config allows some customization of the resolution. By default, domains (e.g. example.eth) will resolve to the owner of the ENS. Sub-domains can be associated with an NFT so that numbers resolve to the token owners. Additional overrides can be specified to map to specific token numbers. Once a record is retrieved, it is signed using a user-provided key to assert its validity, and both record and signature are returned to the caller so they can be provided to the contract that initiated the request.

## [Contracts](packages/contracts)

The smart contract provides a resolver stub that implement CCIP Read (EIP 3668) and ENS wildcard resolution (ENSIP 10). When queried for a name, it directs the client to query the gateway server. When called back with the gateway server response, the resolver verifies the signature was produced by an authorised signer, and returns the response to the client.
