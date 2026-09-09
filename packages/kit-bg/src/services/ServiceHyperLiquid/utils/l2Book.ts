export function buildL2BookByCoinRequest(coin: string) {
  return { coin, nSigFigs: null } as const;
}
