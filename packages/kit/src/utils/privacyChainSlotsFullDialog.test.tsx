import { ETranslations } from '@onekeyhq/shared/src/locale';

import { showPrivacyChainSlotsFullDialog } from './privacyChainSlotsFullDialog';

import type { IntlShape } from 'react-intl';

const mockShow = jest.fn((_args: unknown) => undefined);
jest.mock('@onekeyhq/components', () => ({
  Dialog: { show: (args: unknown) => mockShow(args) },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNetwork: {
      getVaultSettings: async () => ({
        localWallet: { maxEnabledAccounts: 5 },
      }),
    },
  },
}));

const intl = {
  formatMessage: ({ id }: { id: string }, values?: Record<string, unknown>) =>
    values ? `${id}:${JSON.stringify(values)}` : id,
} as unknown as IntlShape;

beforeEach(() => mockShow.mockClear());

it('names the limit and the account, and offers the settings page', async () => {
  const onOpenSettings = jest.fn();
  await showPrivacyChainSlotsFullDialog({
    intl,
    networkId: 'zec--0',
    accountName: 'Account #2',
    onOpenSettings,
  });
  const args = mockShow.mock.calls[0][0] as {
    title: string;
    description: string;
    onConfirmText: string;
    showCancelButton: boolean;
    onConfirm?: () => void;
  };
  expect(args.title).toBe(ETranslations.privacy_slots_full__title);
  expect(args.description).toBe(
    `${ETranslations.privacy_slots_full__desc}:${JSON.stringify({
      max: 5,
      accountName: 'Account #2',
    })}`,
  );
  expect(args.onConfirmText).toBe(ETranslations.global_go_to_settings);
  expect(args.showCancelButton).toBe(true);
  args.onConfirm?.();
  expect(onOpenSettings).toHaveBeenCalledTimes(1);
});

// On the settings page the accounts to turn off are already in view.
it('only explains the limit where the accounts are already listed', async () => {
  await showPrivacyChainSlotsFullDialog({
    intl,
    networkId: 'zec--0',
    accountName: 'Account #2',
  });
  expect(mockShow.mock.calls[0][0]).toMatchObject({
    onConfirmText: ETranslations.global_got_it,
    showCancelButton: false,
  });
});
