import type { ReactElement } from 'react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { showPrivacyChainSlotsFullDialog } from './privacyChainSlotsFullDialog';

import type { IntlShape } from 'react-intl';

const mockShow = jest.fn((_args: unknown) => undefined);
jest.mock('@onekeyhq/components', () => ({
  Dialog: { show: (args: unknown) => mockShow(args) },
}));
jest.mock('@onekeyhq/kit/src/components/PrivacyChainPlacesList', () => ({
  PrivacyChainPlacesList: () => null,
}));

const intl = {
  formatMessage: ({ id }: { id: string }) => id,
} as unknown as IntlShape;

beforeEach(() => mockShow.mockClear());

it('lists the full network’s accounts to delete one on the spot', () => {
  showPrivacyChainSlotsFullDialog({ intl, networkId: 'xmr--0' });
  const args = mockShow.mock.calls[0][0] as {
    title: string;
    description: string;
    renderContent: ReactElement<{ networkId: string }>;
    onConfirmText: string;
    showCancelButton: boolean;
  };
  expect(args.title).toBe(ETranslations.privacy_slots_full__title);
  expect(args.description).toBe(ETranslations.privacy_slots_delete__desc);
  expect(args.renderContent.props.networkId).toBe('xmr--0');
  expect(args.onConfirmText).toBe(ETranslations.global_close);
  expect(args.showCancelButton).toBe(false);
});
