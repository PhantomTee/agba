import { requireStudionetEnv } from "./genlayer-env.mjs";

const env = requireStudionetEnv();
const amountWei = "5000000000000000000000";

const first = await callFund(JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "sim_fundAccount",
  params: [env.GENLAYER_AGENT_ADDRESS, amountWei],
}));

const responses = [first];
if (isStringAmountTypeError(first.body)) {
  responses.push(await callFund(
    `{"jsonrpc":"2.0","id":2,"method":"sim_fundAccount","params":["${env.GENLAYER_AGENT_ADDRESS}",5000000000000000000000]}`,
  ));
}

process.stdout.write(`${JSON.stringify(responses.length === 1 ? responses[0] : responses, null, 2)}\n`);
if (responses.some((entry) => !entry.ok)) process.exit(1);
if (responses[responses.length - 1].body?.error) process.exit(1);

async function callFund(bodyText) {
  const response = await fetch(env.GENLAYER_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: bodyText,
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { ok: response.ok, status: response.status, body };
}

function isStringAmountTypeError(body) {
  return typeof body?.error?.message === "string" && body.error.message.includes("str") && body.error.message.includes("int");
}
