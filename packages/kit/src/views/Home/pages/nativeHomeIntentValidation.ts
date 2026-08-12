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
  if (hasHeaderAction === hasPortfolioItem) {
    return false;
  }

  if (intent.portfolioItemId) {
    return viewModel.portfolio.items.some(
      (item) => item.id === intent.portfolioItemId && item.enabled,
    );
  }

  if (intent.headerActionId === viewModel.header.balanceActionId) {
    return viewModel.header.balanceActionEnabled;
  }

  return viewModel.header.actions.some(
    (action) => action.id === intent.headerActionId && action.enabled,
  );
}
