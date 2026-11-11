/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { PrivacyChainPlacesList } from '.';

import { act, render, screen, waitFor, within } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

// eslint-disable-next-line no-var, vars-on-top
var mockGroups: { accountIds: string[]; address?: string }[] = [];
const mockDelete = jest.fn(
  async (_params: { networkId: string; accountId: string }) => undefined,
);
const mockConfirm = jest.fn(
  (_args: { onConfirm: () => Promise<void> }) => undefined,
);

jest.mock('react-native', () => ({ StyleSheet: { hairlineWidth: 1 } }));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }, values?: { count?: number }) =>
      values?.count === undefined ? id : `${id}: ${values.count}`,
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const { useCallback, useEffect, useState } =
    jest.requireActual<typeof import('react')>('react');
  return {
    usePromiseResult: (fn: () => Promise<unknown>, deps: unknown[]) => {
      const [result, setResult] = useState<unknown>();
      const run = useCallback(async () => {
        setResult(await fn());
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, deps);
      useEffect(() => {
        void run();
      }, [run]);
      return { result, run };
    },
  };
});

jest.mock('@onekeyhq/components', () => {
  const Wrapper = ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>;
  return {
    Dialog: {
      confirm: (args: { onConfirm: () => Promise<void> }) => mockConfirm(args),
      ScrollView: Wrapper,
    },
    useMedia: () => ({ gtMd: false }),
    IconButton: ({
      testID,
      title,
      onPress,
    }: {
      testID?: string;
      title?: string;
      onPress?: () => void;
    }) => (
      <button
        type="button"
        data-testid={testID}
        aria-label={title}
        onClick={onPress}
      />
    ),
    SizableText: Wrapper,
    Spinner: () => null,
    Stack: Wrapper,
    XStack: Wrapper,
    YStack: Wrapper,
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrivacyChain: {
      getLocalWalletNetworkPlaces: async () => ({
        used: mockGroups.length,
        max: 5,
        groups: mockGroups,
      }),
      listLocalWalletAccounts: async () => [
        {
          accountId: 'hd-1--0',
          accountName: 'Account #1',
          walletName: 'Wallet 1',
          deriveLabel: 'BIP44',
        },
        {
          accountId: 'hw-1--0',
          accountName: 'Account #1',
          walletName: 'Pro',
          deriveLabel: 'BIP44',
        },
        // The same wallet and index on the other derivation: told apart by it.
        {
          accountId: 'hd-1--1',
          accountName: 'Account #1',
          walletName: 'Wallet 1',
          deriveLabel: 'Cake Wallet',
        },
      ],
      getLocalWalletAccountState: async ({
        accountId,
      }: {
        accountId: string;
      }) => ({
        enabled: accountId !== 'hd-1--1',
        paused: accountId === 'hd-1--1',
      }),
      deleteLocalWalletAccountData: async (params: {
        networkId: string;
        accountId: string;
      }) => {
        await mockDelete(params);
        mockGroups = mockGroups.filter(
          (group) => !group.accountIds.includes(params.accountId),
        );
      },
    },
  },
}));

beforeEach(() => {
  mockDelete.mockClear();
  mockConfirm.mockClear();
  mockGroups = [
    // The same key on a software and a hardware wallet: one place, one row.
    {
      accountIds: ['hd-1--0', 'hw-1--0'],
      address: '44jKQv6ZSharedAddressOfBothWalletseDx1WR',
    },
    // Paused, still keeping its data.
    { accountIds: ['hd-1--1'], address: '43SMrTtLPausedAccountAddressK44756' },
    // Held by a wallet that is not open now.
    { accountIds: ['hd-9--0'], address: '46R1sU9YLockedWalletAddressNSndB5' },
  ];
});

it('lists every account keeping data by derivation, one block per shared key', async () => {
  render(<PrivacyChainPlacesList networkId="xmr--0" />);
  await waitFor(() =>
    expect(screen.getByTestId('privacy-chain-places-row-hd-9--0')).toBeTruthy(),
  );

  const bip44 = screen.getByTestId('privacy-chain-places-section-BIP44');
  const shared = within(bip44).getByTestId('privacy-chain-places-row-hd-1--0');
  expect(shared.textContent).toContain('Wallet 1 / Account #1');
  expect(shared.textContent).toContain('Pro / Account #1');
  expect(shared.textContent).toContain(ETranslations.global_enabled);
  expect(screen.queryByTestId('privacy-chain-places-row-hw-1--0')).toBeNull();

  // The same wallet and index, told apart by the section it sits in.
  const cake = screen.getByTestId('privacy-chain-places-section-Cake Wallet');
  const paused = within(cake).getByTestId('privacy-chain-places-row-hd-1--1');
  expect(paused.textContent).toContain('Wallet 1 / Account #1');
  expect(paused.textContent).toContain(ETranslations.syncing_paused__title);

  expect(
    screen.getByTestId('privacy-chain-places-row-hd-9--0').textContent,
  ).toContain(`${ETranslations.privacy_slots_locked_wallets__msg}: 1`);
});

it('deletes a row’s data once confirmed and drops the row', async () => {
  render(<PrivacyChainPlacesList networkId="xmr--0" />);
  await waitFor(() =>
    expect(
      screen.getByTestId('privacy-chain-places-delete-hd-1--1'),
    ).toBeTruthy(),
  );

  act(() => {
    screen.getByTestId('privacy-chain-places-delete-hd-1--1').click();
  });
  expect(mockDelete).not.toHaveBeenCalled();
  await act(async () => {
    await mockConfirm.mock.calls[0][0].onConfirm();
  });

  expect(mockDelete).toHaveBeenCalledWith({
    networkId: 'xmr--0',
    accountId: 'hd-1--1',
  });
  expect(screen.queryByTestId('privacy-chain-places-row-hd-1--1')).toBeNull();
  expect(screen.getByTestId('privacy-chain-places-row-hd-1--0')).toBeTruthy();
});
