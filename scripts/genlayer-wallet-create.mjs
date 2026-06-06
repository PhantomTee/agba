import { Wallet } from "ethers";
import { STUDIONET, updateLocalEnv } from "./genlayer-env.mjs";

const wallet = Wallet.createRandom();

updateLocalEnv({
  GENLAYER_CHAIN_ID: STUDIONET.chainId,
  GENLAYER_RPC_URL: STUDIONET.rpcUrl,
  GENLAYER_EXPLORER_URL: STUDIONET.explorerUrl,
  GENLAYER_TOKEN_SYMBOL: STUDIONET.tokenSymbol,
  GENLAYER_PRIVATE_KEY: wallet.privateKey,
  GENLAYER_AGENT_ADDRESS: wallet.address,
  USE_GROQ_FALLBACK: "false",
});

process.stdout.write(`${wallet.address}\n`);
