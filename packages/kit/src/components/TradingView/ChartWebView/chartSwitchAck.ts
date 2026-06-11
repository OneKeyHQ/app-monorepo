// Decide whether an incoming chart->app message confirms that the chart has
// switched to the symbol THIS host drove — used to stop the self-heal
// force-resend (and to gate the loading mask).
//
// Why this exists: the unified chart boots on a placeholder symbol (HL:BTC) and
// the real token arrives via SYMBOL_CHANGE. The placeholder's own boot activity
// (barsState / renderReady) used to falsely "ack" the switch — a symbol-blind
// substring match — so the self-heal that should have recovered a dropped
// SYMBOL_CHANGE got cancelled and the chart stayed on BTC.
//
// Backward compatibility (REQUIRED — old offline/online chart bundles must keep
// working): a NEW chart bundle tags barsState/renderReady with the app's own
// `displayCoin`, so we ack ONLY when it matches the driven symbol. An OLD bundle
// omits `displayCoin` — we then fall back to the prior symbol-blind behavior so
// nothing regresses (the placeholder bug remains only on old bundles, which is
// exactly today's behavior).

const ACK_METHODS = new Set([
  'tradingview_barsState',
  'tradingview_renderReady',
  'tradingview_getKLineData',
]);

export interface IChartMessagePayload {
  method?: string;
  data?: { displayCoin?: string; symbol?: string } & Record<string, unknown>;
}

/**
 * Normalize whatever the host transport hands us (raw JSON string, the
 * `$private` payload, or a `{ data: payload }` wrapper) into the payload object
 * `{ method, data }`. Returns null when it isn't a parseable chart message.
 */
export function unwrapChartMessage(msg: unknown): IChartMessagePayload | null {
  let obj: unknown = msg;
  if (typeof obj === 'string') {
    try {
      obj = JSON.parse(obj);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  // Already the payload: { method, data }
  if (typeof o.method === 'string') return o as IChartMessagePayload;
  // Wrapped: { data: payload }
  const inner = o.data as Record<string, unknown> | undefined;
  if (inner && typeof inner.method === 'string')
    return inner as IChartMessagePayload;
  return null;
}

/**
 * True when `payload` confirms a switch to `drivenSymbol`.
 *
 * - New bundle (barsState/renderReady carry `displayCoin`): ack only on a match.
 * - Old bundle (no `displayCoin`), or `getKLineData` (never carries it, and is
 *   only emitted for real market tokens — never the HL placeholder): keep the
 *   prior symbol-blind ack so behavior is unchanged.
 */
export function isSymbolSwitchAck(
  payload: IChartMessagePayload | null,
  drivenSymbol: string | undefined,
): boolean {
  const method = payload?.method;
  if (!method || !ACK_METHODS.has(method)) return false;
  const displayCoin = payload?.data?.displayCoin;
  // Absent (JSON drops undefined) -> old bundle / getKLineData -> prior behavior.
  if (displayCoin === undefined) return true;
  return !!drivenSymbol && displayCoin === drivenSymbol;
}
