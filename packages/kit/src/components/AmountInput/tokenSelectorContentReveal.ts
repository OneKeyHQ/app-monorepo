export type ITokenSelectorContentReveal = {
  degraded: boolean;
  identityKey: string;
  onNetworkImageDisplay: () => void;
  onTokenImageDisplay: () => void;
  reveal: boolean;
  showNetworkBadge: boolean;
};

export type ITokenSelectorContentRevealStage =
  | 'degraded'
  | 'direct'
  | 'pending'
  | 'ready';

export function getTokenSelectorContentRevealStage(
  contentReveal?: ITokenSelectorContentReveal,
): ITokenSelectorContentRevealStage {
  if (!contentReveal) {
    return 'direct';
  }
  if (contentReveal.degraded) {
    return 'degraded';
  }
  return contentReveal.reveal ? 'ready' : 'pending';
}

export function shouldShowTokenSelectorFallbackNetworkBadge({
  contentReveal,
  isCustomNetwork,
}: {
  contentReveal: ITokenSelectorContentReveal;
  isCustomNetwork?: boolean;
}) {
  return contentReveal.showNetworkBadge || Boolean(isCustomNetwork);
}
