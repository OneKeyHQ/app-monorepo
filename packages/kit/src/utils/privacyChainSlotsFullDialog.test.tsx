import { ETranslations } from '@onekeyhq/shared/src/locale';

import { showPrivacyChainSlotsFullDialog } from './privacyChainSlotsFullDialog';

import type { IntlShape } from 'react-intl';

const mockShow = jest.fn((_args: unknown) => undefined);
jest.mock('@onekeyhq/components', () => ({
  Dialog: { show: (args: unknown) => mockShow(args) },
}));

const intl = {
  formatMessage: ({ id }: { id: string }) => id,
} as unknown as IntlShape;

beforeEach(() => mockShow.mockClear());

it('says only deleting an account’s local data makes room, and offers the settings page', () => {
  const onOpenSettings = jest.fn();
  showPrivacyChainSlotsFullDialog({ intl, onOpenSettings });
  const args = mockShow.mock.calls[0][0] as {
    title: string;
    description: string;
    onConfirmText: string;
    showCancelButton: boolean;
    onConfirm?: () => void;
  };
  expect(args.title).toBe(ETranslations.privacy_slots_full__title);
  expect(args.description).toBe(ETranslations.privacy_slots_delete__desc);
  expect(args.onConfirmText).toBe(ETranslations.global_go_to_settings);
  expect(args.showCancelButton).toBe(true);
  args.onConfirm?.();
  expect(onOpenSettings).toHaveBeenCalledTimes(1);
});

// On the settings page the accounts and their delete action are already in view.
it('only explains the limit where the accounts are already listed', () => {
  showPrivacyChainSlotsFullDialog({ intl });
  expect(mockShow.mock.calls[0][0]).toMatchObject({
    onConfirmText: ETranslations.global_got_it,
    showCancelButton: false,
  });
});
