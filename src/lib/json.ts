/**
 * JSON.stringify replacer that converts BigInt to Number.
 * ethers v6 returns uint256 contract values as BigInt — this prevents
 * "Do not know how to serialize a BigInt" errors in Next.js API routes.
 */
export function bigIntReplacer(_: string, value: unknown): unknown {
  return typeof value === "bigint" ? Number(value) : value;
}

/**
 * Drop-in for NextResponse.json() that handles BigInt values.
 */
export function safeJson(data: unknown, init?: { status?: number }): Response {
  return new Response(JSON.stringify(data, bigIntReplacer), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}
