import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { Anchor, Button, SizableText, YStack } from '../../primitives';

import { PreferenceCapsule } from './PreferenceCapsule';

/**
 * The teach-first beat of creating a hidden wallet, to the ratified
 * design (Figma 21358:33660). The live flow pops a notice dialog before
 * asking for a passphrase; this panel is that beat in stage vocabulary,
 * played on the same surface as every other step. Four blocks on one
 * even rhythm: the definition sentence with its one term emphasized,
 * the single deadliest fact alone in critical red — no recovery, no
 * funds — an understand-before-continuing line whose link IS the phrase
 * (the live dialog's trailing "Learn more", absorbed; the URL is that
 * dialog's own), and the wallet-list shortcut preference worn in the
 * passphrase form's capsule grammar. Continue is the only action and
 * carries the choice out — the form's preference-upstream pattern;
 * stepping away is the surface's own dismissal (the no-standing-footer
 * rule).
 */

const PASSPHRASE_GUIDE_URL =
  'https://help.onekey.so/articles/11461220-passphrases-and-hidden-wallets';

export function PassphraseIntro({
  onContinue,
  resetSignal,
  keepShortcutDefault = true,
}: {
  /** The one exit, carrying the wallet-list shortcut choice with it. */
  onContinue?: (options: { keepShortcut: boolean }) => void;
  /** Fresh-visit signal, the app inputs' own: parked presenters bump it
   * per activation to stand in for a remount's clean slate. */
  resetSignal?: number;
  /**
   * Where the switch starts — the person's remembered choice, fed by the
   * integration layer. Without it a parked card re-opened ON would hand
   * Continue an ON to commit, silently overwriting a stored OFF.
   */
  keepShortcutDefault?: boolean;
}) {
  const intl = useIntl();
  const [keepShortcut, setKeepShortcut] = useState(keepShortcutDefault);
  useEffect(() => {
    setKeepShortcut(keepShortcutDefault);
  }, [resetSignal, keepShortcutDefault]);
  const handleContinue = useCallback(() => {
    onContinue?.({ keepShortcut });
  }, [keepShortcut, onContinue]);
  return (
    <YStack gap="$4">
      <SizableText size="$bodyLg" color="$textSubdued">
        {intl.formatMessage(
          { id: ETranslations.device_stage_passphrase_intro__desc },
          {
            // Keyed: react-intl hands the chunks back inside an array,
            // so the element needs a stable key to keep React quiet.
            strong: (chunks: ReactNode[]) => (
              <SizableText key="strong" size="$bodyLgMedium" color="$text">
                {chunks}
              </SizableText>
            ),
          },
        )}
      </SizableText>
      <SizableText size="$bodyLgMedium" color="$textCritical">
        {intl.formatMessage({
          id: ETranslations.device_stage_passphrase_loss__desc,
        })}
      </SizableText>
      <SizableText size="$bodyLg" color="$textSubdued">
        {intl.formatMessage(
          { id: ETranslations.device_stage_passphrase_understand__desc },
          {
            link: (chunks: ReactNode[]) => (
              <Anchor
                key="link"
                href={PASSPHRASE_GUIDE_URL}
                size="$bodyLg"
                color="$textSubdued"
                showExternalIndicator={false}
                textDecorationLine="underline"
              >
                {chunks}
              </Anchor>
            ),
          },
        )}
      </SizableText>
      <PreferenceCapsule
        testID="device-stage-passphrase-intro-keep-shortcut"
        label={intl.formatMessage({
          id: ETranslations.device_stage_passphrase_shortcut__title,
        })}
        value={keepShortcut}
        onChange={setKeepShortcut}
      />
      {onContinue ? (
        <Button
          testID="device-stage-passphrase-intro-continue"
          variant="primary"
          size="large"
          onPress={handleContinue}
        >
          {intl.formatMessage({ id: ETranslations.global_continue })}
        </Button>
      ) : null}
    </YStack>
  );
}
