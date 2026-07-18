// cspell: words unifold Unifold
// No-op on web/desktop/ext: the connect-react provider is created per deposit
// inside the lazily loaded PerpsUnifoldDepositModal, so nothing may be
// imported here that would pull the Unifold SDK into the main bundle.
// The .native.tsx sibling mounts the real RN provider host.
export function PerpsUnifoldDepositHost() {
  return null;
}
