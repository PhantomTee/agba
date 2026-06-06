import { formatEther, JsonRpcProvider } from "ethers";
import { requireStudionetEnv } from "./genlayer-env.mjs";

const env = requireStudionetEnv();
const provider = new JsonRpcProvider(env.GENLAYER_RPC_URL, Number(env.GENLAYER_CHAIN_ID));
const balance = await provider.getBalance(env.GENLAYER_AGENT_ADDRESS);

process.stdout.write(`${formatEther(balance)} GEN\n`);
