/**
 * @jest-environment jsdom
 */

import * as React from 'react';

import { render } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

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
let mockUIIdle: Promise<void> = Promise.resolve();

jest.mock('@onekeyhq/components', () => {
  const Box = ({
    children,
    bg,
    style,
    'aria-label': ariaLabel,
  }: {
    children?: React.ReactNode;
    bg?: string;
    style?: React.CSSProperties;
    'aria-label'?: string;
  }) => (
    <div data-bg={bg} style={style} aria-label={ariaLabel}>
      {children}
    </div>
  );
  return {
    Icon: ({ name }: { name: string }) => <span data-icon={name} />,
    SizableText: ({ children }: { children?: React.ReactNode }) => (
      <span data-text="">{children}</span>
    ),
    Skeleton: () => <i data-skeleton="" />,
    Stack: Box,
    Tooltip: ({
      renderContent,
      renderTrigger,
    }: {
      renderContent?: React.ReactNode;
      renderTrigger?: React.ReactNode;
    }) => (
      <div
        data-tooltip={typeof renderContent === 'string' ? renderContent : ''}
      >
        {renderTrigger}
      </div>
    ),
    XStack: Box,
  };
});

jest.mock('react-intl', () => ({
  ...jest.requireActual<typeof import('react-intl')>('react-intl'),
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

// The desktop header helpers live beside the account trigger, whose imports
// (avatar, animation) this suite does not need.
jest.mock('./AccountSelectorTrigger/AccountSelectorTriggerBase', () => ({
  DESKTOP_HEADER_TRIGGER_PROPS: {},
  DESKTOP_HEADER_TRIGGER_SHAPE: {},
  DesktopHeaderHitArea: () => null,
  handleDesktopHeaderKeyDown: jest.fn(),
}));

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

jest.mock('../../utils/deferHeavyWork', () => ({
  deferHeavyWorkUntilUIIdle: () => mockUIIdle,
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
    mockUIIdle = Promise.resolve();
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

  // Slack 09-23 QA report (blank account selector right after a cold start):
  // the dot is a hint covered by its cached value, so the first query after
  // launch waits for the UI. PR #13695 review: later runs (explicit refreshes
  // after the user created an address, remounts) must not wait, and a run
  // deferred past its unmount would drop its cache write.
  it('defers only the first missing-address query after launch', async () => {
    let FreshTrigger: typeof AllNetworksManagerTrigger =
      AllNetworksManagerTrigger;
    // A fresh module copy resets the once-per-launch flag; React itself must
    // stay the instance the renderer uses.
    jest.isolateModules(() => {
      jest.doMock('react', () => React);
      FreshTrigger = (
        jest.requireActual('./AllNetworksManagerTrigger') as {
          AllNetworksManagerTrigger: typeof AllNetworksManagerTrigger;
        }
      ).AllNetworksManagerTrigger;
    });
    mockCompatQueries({ walletReady: true, accountReady: true });
    mockGetNetworkIdsWithoutAccount.mockResolvedValue(['evm--56']);
    let markIdle: () => void = () => {};
    mockUIIdle = new Promise<void>((resolve) => {
      markIdle = resolve;
    });

    render(<FreshTrigger num={0} unifiedMode />);
    const query = mockMissingAddressQueries.at(-1);

    const first = query?.method();
    await Promise.resolve();
    expect(mockGetNetworkIdsWithoutAccount).not.toHaveBeenCalled();

    // PR #13695 review: a refresh started while the first run still waits
    // goes straight through instead of inheriting the startup delay.
    await expect(query?.method()).resolves.toEqual(['evm--56']);
    expect(mockGetNetworkIdsWithoutAccount).toHaveBeenCalledTimes(1);

    markIdle();
    await expect(first).resolves.toEqual(['evm--56']);
    expect(mockGetNetworkIdsWithoutAccount).toHaveBeenCalledTimes(2);

    // The UI never settles again, yet a later refresh does not wait either.
    mockUIIdle = new Promise<void>(() => {});
    await expect(query?.method()).resolves.toEqual(['evm--56']);
    expect(mockGetNetworkIdsWithoutAccount).toHaveBeenCalledTimes(3);
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

  // Desktop header: loading keeps the chips' footprint, so the copy button and
  // the page below do not move when the list arrives.
  it('shows a skeleton the size of the chips in the desktop header', () => {
    mockCompatQueries({ walletReady: false, accountReady: false });

    const { container } = render(
      <AllNetworksManagerTrigger num={0} unifiedMode desktopHeader />,
    );

    expect(container.querySelectorAll('[data-skeleton]')).toHaveLength(3);
  });

  it('names the networks and explains the dot in the desktop header', () => {
    mockCompatQueries({
      walletReady: true,
      accountReady: true,
      networkIdsWithoutAccount: ['evm--56'],
    });

    const { container } = render(
      <AllNetworksManagerTrigger num={0} unifiedMode desktopHeader />,
    );

    expect(
      container.querySelector('[data-tooltip]')?.getAttribute('data-tooltip'),
    ).toBe(ETranslations.current_account_missing_addresses);
    expect(
      container.querySelector('[aria-label]')?.getAttribute('aria-label'),
    ).toBe(
      `${ETranslations.network_view_assets_from_n_networks}, ${ETranslations.current_account_missing_addresses}`,
    );
    expect(container.querySelector('[data-bg="$textCaution"]')).not.toBeNull();
    expect(container.querySelector('[data-bg="$caution10"]')).toBeNull();
    // Both logos are cut where the next chip overlaps them.
    expect(
      Array.from(container.querySelectorAll('div')).filter(
        (node) => node.style.maskImage,
      ),
    ).toHaveLength(2);
  });

  it('says All networks on hover when no address is missing', () => {
    mockCompatQueries({ walletReady: true, accountReady: true });

    const { container } = render(
      <AllNetworksManagerTrigger num={0} unifiedMode desktopHeader />,
    );

    expect(
      container.querySelector('[data-tooltip]')?.getAttribute('data-tooltip'),
    ).toBe(ETranslations.global_all_networks);
    expect(container.querySelector('[data-bg="$textCaution"]')).toBeNull();
  });
});
