import { Dialog } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { confirmClearOneKeyIdCache } from './confirmClearOneKeyIdCache';

import type { IntlShape } from 'react-intl';

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: jest.fn(),
  },
}));

const mockedDialogShow = Dialog.show as jest.MockedFunction<typeof Dialog.show>;

function createIntl() {
  return {
    formatMessage: jest.fn(({ id }: { id: string }) => id),
  } as unknown as IntlShape;
}

describe('confirmClearOneKeyIdCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('describes the destructive logout and resolves true after confirmation', async () => {
    const resultPromise = confirmClearOneKeyIdCache({ intl: createIntl() });
    const config = mockedDialogShow.mock.calls[0][0];
    const close = jest.fn(async () => {
      (config.onClose as () => void)();
    });

    expect(config).toEqual(
      expect.objectContaining({
        tone: 'destructive',
        title: ETranslations.prime_onekeyid_log_out,
        description: ETranslations.prime_onekeyid_log_out_description,
        onConfirmText: ETranslations.global_logout,
      }),
    );
    await (
      config.onConfirm as (params: {
        close?: () => Promise<void>;
      }) => Promise<void>
    )({ close });

    await expect(resultPromise).resolves.toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('resolves false when the confirmation is cancelled', async () => {
    const resultPromise = confirmClearOneKeyIdCache({ intl: createIntl() });
    const config = mockedDialogShow.mock.calls[0][0];

    (config.onCancel as () => void)();

    await expect(resultPromise).resolves.toBe(false);
  });
});
