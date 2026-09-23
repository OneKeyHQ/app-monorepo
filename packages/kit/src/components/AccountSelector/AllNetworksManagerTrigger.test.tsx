/**
 * @jest-environment jsdom
 */

import { render } from '@testing-library/react';

import { AllNetworksManagerTrigger } from './AllNetworksManagerTrigger';

/*
yarn jest packages/kit/src/components/AccountSelector/AllNetworksManagerTrigger.test.tsx
*/

type ICompatQueryParams = {
  walletId: string;
  networkId?: string;
  indexedAccountId?: string;
  filterNetworksWithoutAccount?: boolean;
};

type ICompatQueryResult = {
  enabledNetworksCompatibleWithWalletId: typeof compatibleNetworks;
  enabledNetworksWithoutAccount: typeof compatibleNetworks;
  isReady: boolean;
  run: jest.Mock;
};

const compatibleNetworks = [
  { id: 'btc--0', name: 'Bitcoin', logoURI: 'btc.png' },
  { id: 'evm--1', name: 'Ethereum', logoURI: 'eth.png' },
  { id: 'evm--56', name: 'BNB Chain', logoURI: 'bnb.png' },
];

const mockUseCompatQuery = jest.fn<ICompatQueryResult, [ICompatQueryParams]>();

jest.mock('@onekeyhq/components', () => {
  const Box = ({
    children,
    bg,
  }: {
    children?: React.ReactNode;
    bg?: string;
  }) => <div data-bg={bg}>{children}</div>;
  return {
    Icon: ({ name }: { name: string }) => <span data-icon={name} />,
    SizableText: ({ children }: { children?: React.ReactNode }) => (
      <span data-text="">{children}</span>
    ),
    Stack: Box,
    XStack: Box,
  };
});

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: jest.fn() }),
}));

jest.mock('../../hooks/useAllNetwork', () => ({
  useEnabledNetworksCompatibleWithWalletIdInAllNetworks: (
    params: ICompatQueryParams,
  ) => mockUseCompatQuery(params),
}));

jest.mock('../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      network: { id: 'onekeyall--0', isAllNetworks: true },
      wallet: { id: 'hd-1' },
      account: undefined,
      indexedAccount: { id: 'hd-1--3' },
    },
  }),
}));

jest.mock('./hooks/useUnifiedNetworkSelectorTrigger', () => ({
  useUnifiedNetworkSelectorTrigger: () => ({
    showUnifiedNetworkSelector: jest.fn(),
  }),
}));

jest.mock('../NetworkAvatar', () => ({
  NetworkAvatarBase: ({ networkName }: { networkName?: string }) => (
    <span data-network={networkName} />
  ),
}));

function mockCompatQueries({
  walletReady,
  accountReady,
  networksWithoutAccount = [],
}: {
  walletReady: boolean;
  accountReady: boolean;
  networksWithoutAccount?: typeof compatibleNetworks;
}) {
  mockUseCompatQuery.mockImplementation((params: ICompatQueryParams) => {
    const isAccountScoped = !!params.indexedAccountId;
    const ready = isAccountScoped ? accountReady : walletReady;
    return {
      enabledNetworksCompatibleWithWalletId: ready ? compatibleNetworks : [],
      enabledNetworksWithoutAccount:
        ready && isAccountScoped ? networksWithoutAccount : [],
      isReady: ready,
      run: jest.fn(),
    };
  });
}

function renderedNetworkNames(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[data-network]')).map((node) =>
    node.getAttribute('data-network'),
  );
}

describe('AllNetworksManagerTrigger', () => {
  beforeEach(() => {
    mockUseCompatQuery.mockReset();
  });

  // Slack 09-22 QA report: after changing the enabled networks, switching to
  // another account painted an empty chip until that account's query
  // returned. The avatars depend only on the wallet and the enabled set, so a
  // pending per-account query must not hide them.
  it('paints the wallet-scoped avatars while the account query is pending', () => {
    mockCompatQueries({ walletReady: true, accountReady: false });

    const { container } = render(
      <AllNetworksManagerTrigger num={0} unifiedMode />,
    );

    expect(renderedNetworkNames(container)).toEqual(['Bitcoin', 'Ethereum']);
    expect(container.textContent).toContain('+1');
    expect(container.querySelector('[data-bg="$caution10"]')).toBeNull();
  });

  it('queries the avatars per wallet and the missing-address dot per account', () => {
    mockCompatQueries({ walletReady: true, accountReady: true });

    render(<AllNetworksManagerTrigger num={0} unifiedMode />);

    const calls = mockUseCompatQuery.mock.calls.map(([params]) => params);
    // No account in the avatar query, so its cache entry survives switches.
    expect(calls).toContainEqual({
      walletId: 'hd-1',
      networkId: 'onekeyall--0',
    });
    expect(calls).toContainEqual(
      expect.objectContaining({
        walletId: 'hd-1',
        indexedAccountId: 'hd-1--3',
        filterNetworksWithoutAccount: true,
      }),
    );
  });

  it('shows the missing-address dot once the account query reports one', () => {
    mockCompatQueries({
      walletReady: true,
      accountReady: true,
      networksWithoutAccount: [compatibleNetworks[2]],
    });

    const { container } = render(
      <AllNetworksManagerTrigger num={0} unifiedMode />,
    );

    expect(container.querySelector('[data-bg="$caution10"]')).not.toBeNull();
  });

  it('keeps the placeholder until the wallet-scoped query resolves', () => {
    mockCompatQueries({ walletReady: false, accountReady: true });

    const { container } = render(
      <AllNetworksManagerTrigger num={0} unifiedMode />,
    );

    expect(renderedNetworkNames(container)).toEqual([]);
  });
});
