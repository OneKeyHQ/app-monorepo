import type {
  INativeHomeHeaderViewModel,
  INativeHomeIntent,
  INativeHomeNavigationViewModel,
  INativeHomeOwnerToken,
  INativeHomeSpotTokensViewModel,
} from '@onekeyhq/native-components';

export interface INativeHomeIntentValidationContext {
  owner: INativeHomeOwnerToken;
  navigation: INativeHomeNavigationViewModel;
  header: INativeHomeHeaderViewModel;
  spotTokens: INativeHomeSpotTokensViewModel;
}

export function isNativeHomeIntentExecutable({
  intent,
  context,
}: {
  intent: INativeHomeIntent;
  context: INativeHomeIntentValidationContext | null;
}): boolean {
  if (
    !context ||
    intent.owner.scopeKey !== context.owner.scopeKey ||
    intent.owner.sessionId !== context.owner.sessionId
  ) {
    return false;
  }

  const hasHeaderAction = intent.headerActionId !== undefined;
  const hasSpotTokenItem = intent.spotTokenItemId !== undefined;
  const hasSpotTokensAction = intent.spotTokensActionId !== undefined;
  const hasTabSelection = intent.selectTabId !== undefined;
  const hasRefresh = intent.refreshTabId !== undefined;
  if (
    Number(hasHeaderAction) +
      Number(hasSpotTokenItem) +
      Number(hasSpotTokensAction) +
      Number(hasTabSelection) +
      Number(hasRefresh) !==
    1
  ) {
    return false;
  }

  if (intent.spotTokensActionValue !== undefined && !hasSpotTokensAction) {
    return false;
  }

  if (hasTabSelection) {
    return context.navigation.tabs.some(
      (tab) => tab.id === intent.selectTabId && tab.enabled,
    );
  }

  if (hasRefresh) {
    return (
      intent.refreshTabId === context.navigation.selectedTab &&
      context.navigation.tabs.some(
        (tab) => tab.id === intent.refreshTabId && tab.enabled,
      )
    );
  }

  if (intent.spotTokenItemId) {
    return context.spotTokens.items.some(
      (item) => item.id === intent.spotTokenItemId && item.enabled,
    );
  }

  switch (intent.spotTokensActionId) {
    case 'toggleDeFiTokens':
      return (
        context.spotTokens.deFiTokensFilter.visible &&
        context.spotTokens.deFiTokensFilter.enabled &&
        typeof intent.spotTokensActionValue === 'boolean' &&
        intent.spotTokensActionValue !==
          context.spotTokens.deFiTokensFilter.selected
      );
    case 'openLowValueAssets':
      return (
        intent.spotTokensActionValue === undefined &&
        context.spotTokens.lowValueAssets.visible &&
        context.spotTokens.lowValueAssets.enabled
      );
    case 'openRiskAssets':
      return (
        intent.spotTokensActionValue === undefined &&
        context.spotTokens.riskAssets.visible &&
        context.spotTokens.riskAssets.enabled
      );
    case 'manageTokens':
      return (
        intent.spotTokensActionValue === undefined &&
        context.spotTokens.manageTokens.visible &&
        context.spotTokens.manageTokens.enabled
      );
    default:
      break;
  }

  if (intent.headerActionId === context.header.balanceActionId) {
    return context.header.balanceActionEnabled;
  }

  return context.header.actions.some(
    (action) => action.id === intent.headerActionId && action.enabled,
  );
}
