/**
 * Steem Games — Steem RPC node registry and health-based selector.
 * Intended for Cloudflare Worker/server-side use (never from the browser).
 *
 * A node is healthy only when a JSON-RPC request returns a valid condenser result.
 * The fastest healthy node is selected; callers should retry another healthy node
 * if a later application request fails.
 */
export const STEEM_API_NODES = [
  "https://api.steemit.com",
  "https://steemd.minnowsupportproject.org",
  "https://steemd.privex.io",
  "https://steemd.steemgigs.org",
  "https://rpc.curiesteem.com",
  "https://rpc.steemliberator.com",
  "https://rpc.steemviz.com"
];

const PROBE_TIMEOUT_MS = 4500;
const CACHE_TTL_MS = 60_000;
let cachedSelection = null;
let cachedAt = 0;

async function probeNode(url, timeoutMs = PROBE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "condenser_api.get_chain_properties",
        params: [],
        id: 1
      }),
      signal: controller.signal
    });

    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const payload = await response.json();
    const result = payload?.result;
    if (
      payload?.error ||
      !result ||
      typeof result.account_creation_fee !== "string" ||
      typeof result.maximum_block_size !== "number"
    ) {
      throw new Error("INVALID_RPC_RESPONSE");
    }

    return { url, ok: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      url,
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error?.name === "AbortError" ? "TIMEOUT" : String(error?.message || "REQUEST_FAILED")
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Probe all configured nodes and return the fastest healthy node.
 * Result includes per-node diagnostics for logs/monitoring.
 */
export async function selectSteemApi({ force = false } = {}) {
  if (!force && cachedSelection && Date.now() - cachedAt < CACHE_TTL_MS) {
    return { ...cachedSelection, cached: true };
  }

  const checks = await Promise.all(STEEM_API_NODES.map(url => probeNode(url)));
  const healthy = checks.filter(check => check.ok).sort((a, b) => a.latencyMs - b.latencyMs);
  const selection = {
    selected: healthy[0]?.url || null,
    latencyMs: healthy[0]?.latencyMs ?? null,
    checkedAt: new Date().toISOString(),
    healthyCount: healthy.length,
    checks
  };

  cachedSelection = selection.selected ? selection : null;
  cachedAt = Date.now();
  return { ...selection, cached: false };
}

/**
 * Send a JSON-RPC call to the selected node, trying remaining healthy nodes
 * in ascending latency order if the request fails.
 */
export async function steemRpc(method, params, { timeoutMs = 8000 } = {}) {
  const selection = await selectSteemApi();
  const candidates = [
    ...(selection.selected ? [selection.selected] : []),
    ...selection.checks
      .filter(check => check.ok && check.url !== selection.selected)
      .sort((a, b) => a.latencyMs - b.latencyMs)
      .map(check => check.url)
  ];

  let lastError = null;
  for (const url of candidates) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const payload = await response.json();
      if (payload?.error || !("result" in (payload || {}))) {
        throw new Error("INVALID_RPC_RESPONSE");
      }
      return { result: payload.result, api: url };
    } catch (error) {
      lastError = error;
      cachedSelection = null;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`STEEM_RPC_UNAVAILABLE: ${lastError?.message || "no healthy API nodes"}`);
}
