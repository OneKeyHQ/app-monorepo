import type {
  INativeHomeIntent,
  INativeHomeViewModel,
} from '@onekeyhq/native-components';

import { isNativeHomeIntentExecutable } from './nativeHomeIntentValidation';

function buildViewModel(): INativeHomeViewModel {
  return {
    protocolVersion: 1,
    owner: { scopeKey: 'wallet-a|account-a|network-a', sessionId: 'a:2' },
    selectedTab: 'portfolio',
    header: {
      state: 'ready',
      balanceText: '$10.00',
      balanceHidden: false,
      balanceActionId: 'toggleBalanceVisibility',
      balanceActionEnabled: true,
      actionLayout: 'funded',
      actionSubtitle: '',
      actions: [
        { id: 'send', title: 'Send', icon: 'send', enabled: true },
        { id: 'buy', title: 'Buy', icon: 'buy', enabled: false },
      ],
    },
    tabs: [{ id: 'portfolio', title: 'Portfolio', enabled: true }],
    portfolio: {
      title: 'Tokens',
      state: 'ready',
      emptyText: 'No tokens',
      items: [
        {
          id: 'eth',
          symbol: 'ETH',
          iconUrl: '',
          networkIconUrl: '',
          enabled: true,
        },
      ],
    },
    theme: {
      colorScheme: 'light',
      backgroundColor: '#FFFFFF',
      surfaceColor: '#F2F2F7',
      primaryTextColor: '#000000',
      secondaryTextColor: '#636366',
      disabledTextColor: '#8E8E93',
      accentColor: '#239B18',
    },
  };
}

describe('Native Home intent validation', () => {
  it('accepts only an enabled action from the current owner session', () => {
    const viewModel = buildViewModel();
    const intent: INativeHomeIntent = {
      owner: viewModel.owner,
      headerActionId: 'send',
    };
    expect(isNativeHomeIntentExecutable({ intent, viewModel })).toBe(true);
    expect(
      isNativeHomeIntentExecutable({
        intent: { ...intent, headerActionId: 'buy' },
        viewModel,
      }),
    ).toBe(false);
  });

  it('rejects an A to B to A intent from the old A session', () => {
    const viewModel = buildViewModel();
    const staleIntent: INativeHomeIntent = {
      owner: { ...viewModel.owner, sessionId: 'a:1' },
      headerActionId: 'send',
    };
    expect(
      isNativeHomeIntentExecutable({ intent: staleIntent, viewModel }),
    ).toBe(false);
  });

  it('rejects actions absent from the current Header ViewModel', () => {
    const viewModel = buildViewModel();
    expect(
      isNativeHomeIntentExecutable({
        intent: { owner: viewModel.owner, headerActionId: 'receive' },
        viewModel,
      }),
    ).toBe(false);
  });

  it('accepts only an enabled Portfolio item from the current ViewModel', () => {
    const viewModel = buildViewModel();
    expect(
      isNativeHomeIntentExecutable({
        intent: { owner: viewModel.owner, portfolioItemId: 'eth' },
        viewModel,
      }),
    ).toBe(true);
    expect(
      isNativeHomeIntentExecutable({
        intent: { owner: viewModel.owner, portfolioItemId: 'btc' },
        viewModel,
      }),
    ).toBe(false);
  });

  it('rejects ambiguous intents carrying two commands', () => {
    const viewModel = buildViewModel();
    expect(
      isNativeHomeIntentExecutable({
        intent: {
          owner: viewModel.owner,
          headerActionId: 'send',
          portfolioItemId: 'eth',
        },
        viewModel,
      }),
    ).toBe(false);
  });
});
