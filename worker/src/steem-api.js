/**
 * Steem RPC adapter used only by the Steem Games Cloudflare Worker.
 * Uses public condenser_api endpoints with timeout and failover.
 */
const STEEM_API_NODES = [
  "https://api.steemit.com",
  "https://steemd.minnowsupportproject.org",
  "https://steemd.privex.io",
  "https://steemd.steemgigs.org"
];

const REQUEST_TIMEOUT_MS = 3000;
let preferredNode = 0;

export async function steemRpc(method, params) {
  let lastError = null;
  for (let offset = 0; offset < STEEM_API_NODES.length; offset += 1) {
    const index = (preferredNode + offset) % STEEM_API_NODES.length;
    const endpoint = STEEM_API_NODES[index];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const payload = await response.json();
      if (payload?.error || !payload || !("result" in payload)) {
        throw new Error("INVALID_RPC_RESPONSE");
      }
      preferredNode = index;
      return payload.result;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`STEEM_RPC_UNAVAILABLE: ${lastError?.message || "all nodes failed"}`);
}
