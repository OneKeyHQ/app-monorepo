// WalletConnect Pay expiry helpers shared by the options page (countdown /
// continue gate) and the action executor (per-action deadline re-checks).

// expiresAt values from the Pay server may be a seconds or milliseconds epoch
export function normalizeWcPayExpiryMs(
  expiresAt: number | undefined,
): number | undefined {
  if (!expiresAt || expiresAt <= 0) {
    return undefined;
  }
  return expiresAt > 1e12 ? expiresAt : expiresAt * 1000;
}

// The earliest of the payment-level and option-level deadlines is the
// effective one: either of them expiring invalidates further on-chain actions.
export function getWcPayEffectiveExpiryMs({
  infoExpiresAt,
  optionExpiresAt,
}: {
  infoExpiresAt: number | undefined;
  optionExpiresAt: number | undefined;
}): number | undefined {
  const infoMs = normalizeWcPayExpiryMs(infoExpiresAt);
  const optionMs = normalizeWcPayExpiryMs(optionExpiresAt);
  if (infoMs === undefined) {
    return optionMs;
  }
  if (optionMs === undefined) {
    return infoMs;
  }
  return Math.min(infoMs, optionMs);
}

// undefined deadline means the server provided no local expiry signal; the
// server-reported payment status stays the only gate then
export function isWcPayExpired(
  expiryMs: number | undefined,
  nowMs: number = Date.now(),
): boolean {
  return expiryMs !== undefined && nowMs >= expiryMs;
}
