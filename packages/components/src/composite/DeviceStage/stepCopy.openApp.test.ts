import { ETranslations } from '@onekeyhq/shared/src/locale';

import { resolveWalletMatchOpenAppText } from './stepCopy';

import type { IntlShape } from 'react-intl';

// Enough of an intl to answer formatMessage with the id and its values.
const intl = {
  formatMessage: ({ id }: { id: string }, values?: Record<string, string>) =>
    `<${id}${values ? `:${JSON.stringify(values)}` : ''}>`,
} as unknown as IntlShape;

describe('DeviceStage openApp words', () => {
  it('names the app and the device while checking this wallet', () => {
    expect(
      resolveWalletMatchOpenAppText(intl, 'walletMatch', 'Bitcoin', 'ledger'),
    ).toEqual({
      title: `<${
        ETranslations.hardware_third_party_open_app_on_device__title
      }:{"appName":"Bitcoin","device":"Ledger"}>`,
      sub: '',
    });
  });

  it.each([
    [undefined, 'Bitcoin', 'ledger'],
    ['walletMatch', undefined, 'ledger'],
    ['walletMatch', '', 'ledger'],
    ['walletMatch', 'Bitcoin', undefined],
  ] as const)(
    'leaves the generic label for reason %s, app %s, vendor %s',
    (reason, appName, vendor) => {
      expect(
        resolveWalletMatchOpenAppText(intl, reason, appName, vendor),
      ).toBeUndefined();
    },
  );
});
