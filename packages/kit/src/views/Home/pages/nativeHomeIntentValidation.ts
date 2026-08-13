import type {
  INativeHomeIntent,
  INativeHomeViewModel,
} from '@onekeyhq/native-components';

export function isNativeHomeIntentExecutable({
  intent,
  viewModel,
}: {
  intent: INativeHomeIntent;
  viewModel: INativeHomeViewModel | null;
}): boolean {
  if (
    !viewModel ||
    intent.owner.scopeKey !== viewModel.owner.scopeKey ||
    intent.owner.sessionId !== viewModel.owner.sessionId
  ) {
    return false;
  }

  const hasHeaderAction = intent.headerActionId !== undefined;
  const hasPortfolioItem = intent.portfolioItemId !== undefined;
  const hasPortfolioAction = intent.portfolioActionId !== undefined;
  if (
    Number(hasHeaderAction) +
      Number(hasPortfolioItem) +
      Number(hasPortfolioAction) !==
    1
  ) {
    return false;
  }

  if (intent.portfolioActionValue !== undefined && !hasPortfolioAction) {
    return false;
  }

  if (intent.portfolioItemId) {
    return viewModel.portfolio.items.some(
      (item) => item.id === intent.portfolioItemId && item.enabled,
    );
  }

  switch (intent.portfolioActionId) {
    case 'toggleDeFiTokens':
      return (
        viewModel.portfolio.deFiTokensFilter.visible &&
        viewModel.portfolio.deFiTokensFilter.enabled &&
        typeof intent.portfolioActionValue === 'boolean' &&
        intent.portfolioActionValue !==
          viewModel.portfolio.deFiTokensFilter.selected
      );
    case 'openLowValueAssets':
      return (
        intent.portfolioActionValue === undefined &&
        viewModel.portfolio.lowValueAssets.visible &&
        viewModel.portfolio.lowValueAssets.enabled
      );
    case 'openRiskAssets':
      return (
        intent.portfolioActionValue === undefined &&
        viewModel.portfolio.riskAssets.visible &&
        viewModel.portfolio.riskAssets.enabled
      );
    case 'manageTokens':
      return (
        intent.portfolioActionValue === undefined &&
        viewModel.portfolio.manageTokens.visible &&
        viewModel.portfolio.manageTokens.enabled
      );
    default:
      break;
  }

  if (intent.headerActionId === viewModel.header.balanceActionId) {
    return viewModel.header.balanceActionEnabled;
  }

  return viewModel.header.actions.some(
    (action) => action.id === intent.headerActionId && action.enabled,
  );
}
