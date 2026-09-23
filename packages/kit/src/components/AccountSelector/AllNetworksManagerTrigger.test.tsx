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
  isReady: boolean;
  run: jest.Mock;
};

type IMissingAddressQuery = {
  method: () => Promise<string[] | undefined>;
  deps: unknown[];
  options: { swrKey?: string; revalidateOnFocus?: boolean };
};

const compatibleNetworks = [
  { id: 'btc--0', name: 'Bitcoin', logoURI: 'btc.png' },
  { id: 'evm--1', name: 'Ethereum', logoURI: 'eth.png' },
  { id: 'evm--56', name: 'BNB Chain', logoURI: 'bnb.png' },
];

const mockUseCompatQuery = jest.fn<ICompatQueryResult, [ICompatQueryParams]>();
const mockMissingAddressQueries: IMissingAddressQuery[] = [];
let mockMissingAddressResult: string[] | undefined;
const mockGetNetworkIdsWithoutAccount = jest.fn<
  Promise<string[]>,
  [{ indexedAccountId: string; networkIds: string[] }]
>();

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

jest.mock('../../hooks/usePromiseResult', () => ({
  usePromiseResult: (
    method: IMissingAddressQuery['method'],
    deps: unknown[],
    options: IMissingAddressQuery['options'],
  ) => {
    mockMissingAddressQueries.push({ method, deps, options });
    return { result: mockMissingAddressResult, run: jest.fn() };
  },
}));

jest.mock('../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAllNetwork: {
      getNetworkIdsWithoutAccountInIndexedAccount: (params: {
        indexedAccountId: string;
        networkIds: string[];
      }) => mockGetNetworkIdsWithoutAccount(params),
    },
  },
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
  networkIdsWithoutAccount = [],
}: {
  walletReady: boolean;
  accountReady: boolean;
  networkIdsWithoutAccount?: string[];
}) {
  mockUseCompatQuery.mockImplementation(() => ({
    enabledNetworksCompatibleWithWalletId: walletReady
      ? compatibleNetworks
      : [],
    isReady: walletReady,
    run: jest.fn(),
  }));
  mockMissingAddressResult = accountReady
    ? networkIdsWithoutAccount
    : undefined;
}

function renderedNetworkNames(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[data-network]')).map((node) =>
    node.getAttribute('data-network'),
  );
}

describe('AllNetworksManagerTrigger', () => {
  beforeEach(() => {
    mockUseCompatQuery.mockReset();
    mockGetNetworkIdsWithoutAccount.mockReset();
    mockMissingAddressQueries.length = 0;
    mockMissingAddressResult = undefined;
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
    expect(mockMissingAddressQueries.at(-1)?.options.swrKey).toBe(
      'allNetCompat:noAddr:v1:hd-1:hd-1--3',
    );
  });

  // PR #13695 review: a second full compat query per account repeated the
  // network list and compatibility walk on every switch, focus and refresh.
  it('runs the full compat query once and asks only for the missing addresses per account', async () => {
    mockCompatQueries({ walletReady: true, accountReady: true });
    mockGetNetworkIdsWithoutAccount.mockResolvedValue(['evm--56']);

    render(<AllNetworksManagerTrigger num={0} unifiedMode />);

    expect(
      mockUseCompatQuery.mock.calls.every(
        ([params]) =>
          !params.indexedAccountId && !params.filterNetworksWithoutAccount,
      ),
    ).toBe(true);
    await expect(mockMissingAddressQueries.at(-1)?.method()).resolves.toEqual([
      'evm--56',
    ]);
    expect(mockGetNetworkIdsWithoutAccount).toHaveBeenCalledWith({
      indexedAccountId: 'hd-1--3',
      networkIds: ['btc--0', 'evm--1', 'evm--56'],
    });
  });

  it('does not ask for missing addresses before the wallet-scoped list resolves', async () => {
    mockCompatQueries({ walletReady: false, accountReady: false });

    render(<AllNetworksManagerTrigger num={0} unifiedMode />);

    await expect(
      mockMissingAddressQueries.at(-1)?.method(),
    ).resolves.toBeUndefined();
    expect(mockGetNetworkIdsWithoutAccount).not.toHaveBeenCalled();
  });

  it('shows the missing-address dot once the account query reports one', () => {
    mockCompatQueries({
      walletReady: true,
      accountReady: true,
      networkIdsWithoutAccount: ['evm--56'],
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
