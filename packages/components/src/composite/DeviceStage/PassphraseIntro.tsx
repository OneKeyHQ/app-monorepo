import { useCallback, useEffect, useState } from 'react';

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
 * rule). Copy is hardcoded for now; i18n lands stage-wide later.
 */

const PASSPHRASE_GUIDE_URL =
  'https://help.onekey.so/articles/11461220-passphrases-and-hidden-wallets';

export function PassphraseIntro({
  onContinue,
  resetSignal,
}: {
  /** The one exit, carrying the wallet-list shortcut choice with it. */
  onContinue?: (options: { keepShortcut: boolean }) => void;
  /** Fresh-visit signal, the app inputs' own: parked presenters bump it
   * per activation to stand in for a remount's clean slate. */
  resetSignal?: number;
}) {
  // The design's first-run default: keep the shortcut. Remembering the
  // person's previous choice is the integration layer's.
  const [keepShortcut, setKeepShortcut] = useState(true);
  useEffect(() => {
    setKeepShortcut(true);
  }, [resetSignal]);
  const handleContinue = useCallback(() => {
    onContinue?.({ keepShortcut });
  }, [keepShortcut, onContinue]);
  return (
    <YStack gap="$4">
      <SizableText size="$bodyLg" color="$textSubdued">
        A hidden wallet adds a{' '}
        <SizableText size="$bodyLgMedium" color="$text">
          passphrase
        </SizableText>{' '}
        to your recovery phrase to create a separate, secure wallet.
      </SizableText>
      <SizableText size="$bodyLgMedium" color="$textCritical">
        If you lose it, no one can recover it — or the funds in its wallet.
      </SizableText>
      <SizableText size="$bodyLg" color="$textSubdued">
        Make sure you understand{' '}
        <Anchor
          href={PASSPHRASE_GUIDE_URL}
          size="$bodyLg"
          color="$textSubdued"
          showExternalIndicator={false}
          textDecorationLine="underline"
        >
          how a passphrase works
        </Anchor>{' '}
        before continuing.
      </SizableText>
      <PreferenceCapsule
        testID="device-stage-passphrase-intro-keep-shortcut"
        label="Keep a shortcut on the wallet list"
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
          Continue
        </Button>
      ) : null}
    </YStack>
  );
}
