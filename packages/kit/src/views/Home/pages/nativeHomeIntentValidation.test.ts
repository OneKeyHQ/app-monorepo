import type { INativeHomeIntent } from '@onekeyhq/native-components';

import {
  type INativeHomeIntentValidationContext,
  isNativeHomeIntentExecutable,
} from './nativeHomeIntentValidation';

function buildContext(): INativeHomeIntentValidationContext {
  return {
    owner: { scopeKey: 'wallet-a|account-a|network-a', sessionId: 'a:2' },
    navigation: {
      selectedTab: 'portfolio',
      tabs: [
        { id: 'portfolio', title: 'Portfolio', enabled: true },
        { id: 'history', title: 'History', enabled: true },
        { id: 'nft', title: 'NFT', enabled: false },
      ],
    },
    header: {
      state: 'ready',
      balanceText: '$10.00',
      balanceHidden: false,
      balanceActionId: 'toggleBalanceVisibility',
      balanceActionEnabled: true,
      bannerVisible: false,
      actionLayout: 'funded',
      actionSubtitle: '',
      actions: [
        { id: 'send', title: 'Send', icon: 'send', enabled: true },
        { id: 'buy', title: 'Buy', icon: 'buy', enabled: false },
      ],
    },
    spotTokens: {
      title: 'Tokens',
      state: 'ready',
      emptyText: 'No tokens',
      showMoreTitle: 'Show more',
      showLessTitle: 'Show less',
      initialVisibleItemCount: 6,
      items: [
        {
          id: 'eth',
          symbol: 'ETH',
          iconUrl: '',
          networkIconUrl: '',
          priceText: '$10.00',
          priceChangeText: '+1.00%',
          priceChangeDirection: 'positive',
          balanceText: '1',
          valueText: '$10.00',
          valuationState: 'ready',
          enabled: true,
        },
      ],
      deFiTokensFilter: {
        visible: true,
        title: 'DeFi tokens',
        selected: false,
        loading: false,
        enabled: true,
      },
      lowValueAssets: {
        visible: true,
        title: '8 Low-value assets',
        valueText: '$0.00',
        enabled: true,
      },
      riskAssets: {
        visible: true,
        title: '70 Collapsed risk assets',
        enabled: true,
      },
      manageTokens: {
        visible: true,
        instruction: "Can't find your token?",
        actionTitle: 'Add token',
        enabled: true,
      },
    },
  };
}

describe('Native Home intent validation', () => {
  it('accepts only an enabled action from the current owner session', () => {
    const context = buildContext();
    const intent: INativeHomeIntent = {
      owner: context.owner,
      headerActionId: 'send',
    };
    expect(isNativeHomeIntentExecutable({ intent, context })).toBe(true);
    expect(
      isNativeHomeIntentExecutable({
        intent: { ...intent, headerActionId: 'buy' },
        context,
      }),
    ).toBe(false);
  });

  it('rejects an A to B to A intent from the old A session', () => {
    const context = buildContext();
    const staleIntent: INativeHomeIntent = {
      owner: { ...context.owner, sessionId: 'a:1' },
      headerActionId: 'send',
    };
    expect(isNativeHomeIntentExecutable({ intent: staleIntent, context })).toBe(
      false,
    );
  });

  it('rejects actions absent from the current Header ViewModel', () => {
    const context = buildContext();
    expect(
      isNativeHomeIntentExecutable({
        intent: { owner: context.owner, headerActionId: 'receive' },
        context,
      }),
    ).toBe(false);
  });

  it('accepts only an enabled Portfolio item from the current ViewModel', () => {
    const context = buildContext();
    expect(
      isNativeHomeIntentExecutable({
        intent: { owner: context.owner, spotTokenItemId: 'eth' },
        context,
      }),
    ).toBe(true);
    expect(
      isNativeHomeIntentExecutable({
        intent: { owner: context.owner, spotTokenItemId: 'btc' },
        context,
      }),
    ).toBe(false);
  });

  it('rejects ambiguous intents carrying two commands', () => {
    const context = buildContext();
    expect(
      isNativeHomeIntentExecutable({
        intent: {
          owner: context.owner,
          headerActionId: 'send',
          spotTokenItemId: 'eth',
        },
        context,
      }),
    ).toBe(false);
  });

  it('accepts refresh only for the current enabled tab', () => {
    const context = buildContext();
    expect(
      isNativeHomeIntentExecutable({
        intent: {
          owner: context.owner,
          refreshTabId: 'portfolio',
        },
        context,
      }),
    ).toBe(true);
    expect(
      isNativeHomeIntentExecutable({
        intent: {
          owner: context.owner,
          refreshTabId: 'history',
        },
        context,
      }),
    ).toBe(false);
    expect(
      isNativeHomeIntentExecutable({
        intent: {
          owner: { ...context.owner, sessionId: 'a:1' },
          refreshTabId: 'portfolio',
        },
        context,
      }),
    ).toBe(false);
    expect(
      isNativeHomeIntentExecutable({
        intent: {
          owner: context.owner,
          headerActionId: 'send',
          refreshTabId: 'portfolio',
        },
        context,
      }),
    ).toBe(false);

    context.navigation.tabs[0]!.enabled = false;
    expect(
      isNativeHomeIntentExecutable({
        intent: {
          owner: context.owner,
          refreshTabId: 'portfolio',
        },
        context,
      }),
    ).toBe(false);
  });

  it('accepts selection only for a current enabled tab', () => {
    const context = buildContext();
    expect(
      isNativeHomeIntentExecutable({
        intent: { owner: context.owner, selectTabId: 'history' },
        context,
      }),
    ).toBe(true);
    expect(
      isNativeHomeIntentExecutable({
        intent: { owner: context.owner, selectTabId: 'nft' },
        context,
      }),
    ).toBe(false);
    expect(
      isNativeHomeIntentExecutable({
        intent: {
          owner: context.owner,
          selectTabId: 'history',
          refreshTabId: 'portfolio',
        },
        context,
      }),
    ).toBe(false);
  });

  it('revalidates Portfolio actions against the current ViewModel', () => {
    const context = buildContext();
    expect(
      isNativeHomeIntentExecutable({
        intent: {
          owner: context.owner,
          spotTokensActionId: 'toggleDeFiTokens',
          spotTokensActionValue: true,
        },
        context,
      }),
    ).toBe(true);
    expect(
      isNativeHomeIntentExecutable({
        intent: {
          owner: context.owner,
          spotTokensActionId: 'openLowValueAssets',
        },
        context,
      }),
    ).toBe(true);

    context.spotTokens.lowValueAssets.visible = false;
    context.spotTokens.deFiTokensFilter.loading = true;
    context.spotTokens.deFiTokensFilter.enabled = false;
    expect(
      isNativeHomeIntentExecutable({
        intent: {
          owner: context.owner,
          spotTokensActionId: 'openLowValueAssets',
        },
        context,
      }),
    ).toBe(false);
    expect(
      isNativeHomeIntentExecutable({
        intent: {
          owner: context.owner,
          spotTokensActionId: 'toggleDeFiTokens',
          spotTokensActionValue: true,
        },
        context,
      }),
    ).toBe(false);
  });
});
