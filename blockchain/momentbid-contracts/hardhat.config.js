require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    wirefluid: {
      url: process.env.WIREFLUID_RPC_URL || "https://evm.wirefluid.com",
      chainId: 92533,
      accounts: deployerPrivateKey ? [deployerPrivateKey] : [],
      gasPrice: 10000000000
    },
    localhost: {
      url: "http://127.0.0.1:8545"
    }
  }
};
