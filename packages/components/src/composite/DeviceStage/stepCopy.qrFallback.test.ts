import { ETranslations } from '@onekeyhq/shared/src/locale';

import { resolveQrFallbackText } from './stepCopy';

import type { IntlShape } from 'react-intl';

// Enough of an intl to answer formatMessage with the id it was given.
const intl = {
  formatMessage: ({ id }: { id: string }) => `<${id}>`,
} as unknown as IntlShape;

describe('DeviceStage qrFallback words', () => {
  it.each([undefined, 'payload-too-large'] as const)(
    'keeps the oversized-request words for %s',
    (reason) => {
      expect(resolveQrFallbackText(intl, reason)).toEqual({
        title: `<${ETranslations.qr_connection_cta}>`,
        sub: `<${ETranslations.hardware_third_party_qr_fallback__desc}>`,
      });
    },
  );

  it.each([
    [
      'wallet-mismatch',
      ETranslations.hardware_third_party_device_mismatch,
      ETranslations.hardware_third_party_qr_fallback_wallet_mismatch__desc,
    ],
    [
      'device-locked',
      ETranslations.hardware_third_party_device_locked,
      ETranslations.hardware_third_party_qr_fallback_device_locked__desc,
    ],
    [
      'usb-unavailable',
      ETranslations.settings_unable_to_connect,
      ETranslations.hardware_third_party_qr_fallback_usb_unavailable__desc,
    ],
  ] as const)(
    'names what is wrong with the connected device: %s',
    (reason, title, sub) => {
      expect(resolveQrFallbackText(intl, reason)).toEqual({
        title: `<${title}>`,
        sub: `<${sub}>`,
      });
    },
  );
});
