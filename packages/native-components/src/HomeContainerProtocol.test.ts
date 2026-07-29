import {
  isHomeContainerStateValid,
  parseHomeContainerIntent,
} from './HomeContainerProtocol';

import type { IHomeContainerState } from './HomeContainer.types';

function buildState(): IHomeContainerState {
  return {
    owner: { scopeKey: 'wallet:account:all', sessionId: 'session' },
    payload: {
      selectedTabId: 'portfolio',
      header: {
        accountName: 'Account',
        balance: '$0',
        actions: [],
        banners: [],
      },
      tabs: [
        {
          id: 'portfolio',
          title: 'Portfolio',
          destination: 'inline',
          sections: [],
        },
      ],
      theme: {
        backgroundColor: '#fff',
        cardColor: '#fff',
        dividerColor: '#eee',
        primaryTextColor: '#111',
        secondaryTextColor: '#777',
        accentColor: '#00f',
        positiveColor: '#0a0',
        negativeColor: '#f00',
      },
    },
  };
}

describe('HomeContainer protocol', () => {
  it('accepts the single supported state shape', () => {
    expect(isHomeContainerStateValid(buildState())).toBe(true);
  });

  it('parses owner-scoped intents', () => {
    expect(
      parseHomeContainerIntent(
        JSON.stringify({
          intentId: 'intent',
          owner: { scopeKey: 'wallet:account:all', sessionId: 'session' },
          intent: { kind: 'selectTab', tabId: 'portfolio' },
        }),
      ),
    ).toMatchObject({
      intentId: 'intent',
      intent: { kind: 'selectTab', tabId: 'portfolio' },
    });
  });
});
