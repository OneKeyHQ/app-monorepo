let proposalCount = 0;
const listeners = new Set<() => void>();

export function isWalletConnectProposalOpen() {
  return proposalCount > 0;
}

export function subscribeWalletConnectProposalVisibility(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function trackWalletConnectProposal() {
  proposalCount += 1;
  if (proposalCount === 1) {
    listeners.forEach((listener) => listener());
  }
  return () => {
    proposalCount -= 1;
    if (proposalCount === 0) {
      listeners.forEach((listener) => listener());
    }
  };
}
