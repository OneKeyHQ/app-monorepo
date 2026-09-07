import { createIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { loadLocaleMessages } from '@onekeyhq/shared/src/locale/localeLoaders';

import { resolveCapsuleText, resolveErrorMessage } from './stepCopy';

import type { IntlShape } from 'react-intl';

/**
 * The error notice's words (OK-59934). The stage clears the toast that
 * used to speak a failure's own message, so the card carries it —
 * except where a reason already has considered wording of its own.
 */

// Enough of an intl to answer formatMessage with the id it was given.
const intl = {
  formatMessage: ({ id }: { id: string }) => `<${id}>`,
} as unknown as IntlShape;

describe('DeviceStage error localization', () => {
  it.each(['zh-CN', 'en-US'] as const)(
    'uses the UI locale %s even when the background has only fallback text',
    async (locale) => {
      const messages = await loadLocaleMessages(locale);
      const uiIntl = createIntl({ locale, messages });
      for (const key of [
        ETranslations.troubleshooting_desktop_bluetooth_usb_priority,
        ETranslations.hardware_device_pin_state_error,
        ETranslations.hardware_device_passphrase_state_error,
        ETranslations.hardware_device_information_is_inconsistent_it_may_be_caused_by_device_reset,
      ]) {
        const message = resolveErrorMessage(uiIntl, 'Background fallback', {
          key,
        });
        expect(message).toBe(messages[key]);
        expect(
          resolveCapsuleText(
            uiIntl,
            'error',
            'Pro 2',
            undefined,
            undefined,
            message,
          ).title,
        ).toBe(messages[key]);
      }
    },
  );

  it('preserves interpolation parameters and works without a fallback message', async () => {
    const messages = await loadLocaleMessages('zh-CN');
    const uiIntl = createIntl({ locale: 'zh-CN', messages });
    expect(
      resolveErrorMessage(uiIntl, undefined, {
        key: ETranslations.hardware_not_support_passphrase_need_upgrade,
        info: { version: '5.0.0' },
      }),
    ).toBe('使用 Passphrase，需要将固件升级到版本 5.0.0 或更高版本');
  });

  it('keeps the original message when no specific translation is available', () => {
    const uiIntl = createIntl({ locale: 'en-US' });
    for (const errorI18n of [
      undefined,
      { key: ETranslations.hardware_device_pin_state_error },
    ]) {
      expect(resolveErrorMessage(uiIntl, 'SDK detail', errorI18n)).toBe(
        'SDK detail',
      );
    }
    expect(resolveErrorMessage(uiIntl)).toBeUndefined();
  });
});

describe('resolveCapsuleText, error step', () => {
  it('speaks the failure’s own words when no reason claims it', () => {
    expect(
      resolveCapsuleText(
        intl,
        'error',
        'Neo DECD',
        undefined,
        undefined,
        'Passphrase does not match the current wallet, please try again',
      ).title,
    ).toBe('Passphrase does not match the current wallet, please try again');
  });

  // The guard that matters: 'disconnected' exists precisely because the
  // raw transport message was unreadable, so it must never be displaced.
  it('keeps a reason’s considered wording over the raw message', () => {
    expect(
      resolveCapsuleText(
        intl,
        'error',
        'Neo DECD',
        undefined,
        'disconnected',
        'Protocol V2 USB read failed: transferIn',
      ).title,
    ).toBe(`<${ETranslations.hardware_third_party_device_disconnected}>`);
  });

  it('falls back to the generic line when there is neither', () => {
    expect(resolveCapsuleText(intl, 'error', 'Neo DECD').title).toBe(
      `<${ETranslations.device_stage_generic_error__title}>`,
    );
  });

  it('leaves the notice’s second line empty either way', () => {
    expect(
      resolveCapsuleText(intl, 'error', 'Neo DECD', undefined, undefined, 'x')
        .sub,
    ).toBe('');
  });
});
