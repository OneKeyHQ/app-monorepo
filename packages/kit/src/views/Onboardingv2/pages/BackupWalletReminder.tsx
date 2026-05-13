import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IKeyOfIcons, IYStackProps } from '@onekeyhq/components';
import {
  AnimatePresence,
  Button,
  Dialog,
  Icon,
  SizableText,
  Toast,
  XStack,
  YStack,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EOnboardingPagesV2,
  IOnboardingParamListV2,
} from '@onekeyhq/shared/src/routes';
import { ensureSensitiveTextEncoded } from '@onekeyhq/shared/src/utils/sensitiveTextUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useRecoveryPhraseProtected } from '../../../hooks/useRecoveryPhraseProtected/useRecoveryPhraseProtected';
import {
  OnboardingHeading,
  OnboardingPage,
  OnboardingSidebar,
} from '../components/Layout';

import type { RouteProp } from '@react-navigation/core';

const ANIMATED_STACK_PROPS = {
  animation: 'quick' as const,
  animateOnly: ANIMATE_ONLY_OPACITY_TRANSFORM,
  enterStyle: { scale: 0.8, opacity: 0 },
};

function PhraseProtection() {
  useRecoveryPhraseProtected();
  return null;
}

function PhraseGrid({
  words,
  onPress,
}: {
  words: string[];
  onPress: () => void;
}) {
  const { gtMd } = useMedia();
  const phraseTextSize = gtMd ? '$bodyMd' : '$bodyLg';

  return (
    <YStack
      w="100%"
      borderRadius="$3"
      bg="$bgSubdued"
      borderWidth={1}
      borderColor="$borderSubdued"
      px="$3"
      py="$2"
      onPress={onPress}
      userSelect="none"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      $gtMd={{
        px: '$2',
      }}
    >
      <XStack flexWrap="wrap">
        {words.map((word, i) => (
          <XStack
            key={i}
            w="50%"
            py="$2"
            $gtMd={{
              py: '$1.5',
            }}
            gap="$3"
            alignItems="center"
          >
            <SizableText
              w="$6"
              textAlign="right"
              size={phraseTextSize}
              color="$textDisabled"
            >
              {`${i + 1}.`}
            </SizableText>
            <SizableText size={phraseTextSize}>{word}</SizableText>
          </XStack>
        ))}
      </XStack>
    </YStack>
  );
}

function CopyHintWithPhrase({
  words,
  onCopy,
  ...rest
}: {
  words: string[];
  onCopy: () => void;
} & IYStackProps) {
  const intl = useIntl();
  return (
    <YStack gap="$3" {...rest}>
      <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
        ↓ {intl.formatMessage({ id: ETranslations.click_below_to_copy })} ↓
      </SizableText>
      <PhraseGrid words={words} onPress={onCopy} />
    </YStack>
  );
}

export default function BackupWalletReminder() {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const { gtMd } = useMedia();
  const route =
    useRoute<
      RouteProp<IOnboardingParamListV2, EOnboardingPagesV2.BackupWalletReminder>
    >();

  const [showingPhrase, setShowingPhrase] = useState(false);
  const [mnemonic, setMnemonic] = useState('');

  // Fail-closed: this page must not render a synthetic mnemonic. If the
  // caller failed to pass a valid encoded mnemonic (e.g. the upstream
  // password prompt was cancelled), bail out instead of showing anything the
  // user could mistake for their real recovery phrase.
  useEffect(() => {
    const routeMnemonic = route.params?.mnemonic;
    if (!routeMnemonic) {
      navigation.popStack();
      return;
    }
    try {
      ensureSensitiveTextEncoded(routeMnemonic);
    } catch {
      navigation.popStack();
    }
  }, [navigation, route.params?.mnemonic]);

  const recoveryPhrase = useMemo(
    () => mnemonic.split(' ').filter(Boolean),
    [mnemonic],
  );

  const { copyText } = useClipboard();

  // Decode lazily so the plaintext mnemonic is not in React state while the
  // user is still reading the warning bullets — it only lands in memory when
  // they actually tap "Show Recovery Phrase".
  const handleShowPhrase = useCallback(async () => {
    const routeMnemonic = route.params?.mnemonic;
    if (!routeMnemonic) return;
    const decoded =
      await backgroundApiProxy.servicePassword.decodeSensitiveText({
        encodedText: routeMnemonic,
      });
    setMnemonic(decoded);
    setShowingPhrase(true);
  }, [route.params?.mnemonic]);

  const handleCopyMnemonic = useCallback(() => {
    Dialog.show({
      icon: 'ErrorOutline',
      tone: 'destructive',
      title: intl.formatMessage({
        id: ETranslations.copy_recovery_phrases_warning_title,
      }),
      description: intl.formatMessage({
        id: ETranslations.copy_recovery_phrases_warning_desc,
      }),
      footerProps: {
        flexDirection: 'row-reverse',
      },
      onConfirmText: intl.formatMessage({
        id: ETranslations.copy_anyway,
      }),
      onConfirm: () => {
        copyText(mnemonic);
      },
      confirmButtonProps: {
        testID: 'copy-recovery-phrase-confirm',
        variant: 'secondary',
      },
      onCancelText: intl.formatMessage({
        id: ETranslations.global_cancel_copy,
      }),
      cancelButtonProps: {
        testID: 'copy-recovery-phrase-cancel',
        variant: 'primary',
      },
    });
  }, [copyText, intl, mnemonic]);

  const handleSavedPhrase = useCallback(async () => {
    if (route.params?.walletId) {
      await backgroundApiProxy.serviceAccount.updateWalletBackupStatus({
        walletId: route.params.walletId,
        isBackedUp: true,
      });
    }
    Toast.success({
      title: intl.formatMessage({
        id: ETranslations.backup_recovery_phrase_backed_up,
      }),
    });
    navigation.popStack();
  }, [intl, navigation, route.params?.walletId]);

  const bullets = useMemo<{ text: string; icon: IKeyOfIcons }[]>(
    () => [
      {
        text: intl.formatMessage({
          id: ETranslations.onboarding_bullet_recovery_phrase_full_access,
        }),
        icon: 'LockSolid',
      },
      {
        text: intl.formatMessage({
          id: ETranslations.onboarding_bullet_forgot_passcode_use_recovery,
        }),
        icon: 'InputSolid',
      },
      {
        text: intl.formatMessage({
          id: ETranslations.onboarding_bullet_never_share_recovery_phrase,
        }),
        icon: 'EyeOffSolid',
      },
      {
        text: intl.formatMessage({
          id: ETranslations.onboarding_bullet_onekey_support_no_recovery_phrase,
        }),
        icon: 'Shield2CheckSolid',
      },
    ],
    [intl],
  );

  const mobileShowPhraseBlock = !gtMd && showingPhrase;

  const headerContent = mobileShowPhraseBlock ? (
    <>
      <OnboardingHeading>
        {intl.formatMessage({ id: ETranslations.for_your_eyes_only })}
      </OnboardingHeading>
      <SizableText size="$heading2xl" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.never_share_the_recovery_phrase,
        })}
      </SizableText>
    </>
  ) : (
    <OnboardingHeading>
      {intl.formatMessage({
        id: ETranslations.onboarding_save_phrase_securely_instruction,
      })}
    </OnboardingHeading>
  );

  return (
    <OnboardingPage scrollable>
      <YStack $md={{ flex: 1 }} $gtMd={{ flexDirection: 'row' }}>
        <YStack gap="$8" $gtMd={{ flex: 1, gap: '$12' }}>
          <YStack gap="$2">{headerContent}</YStack>
          <AnimatePresence initial={false} exitBeforeEnter>
            {mobileShowPhraseBlock ? (
              <CopyHintWithPhrase
                key="mobile-phrase-content"
                words={recoveryPhrase}
                onCopy={handleCopyMnemonic}
                {...ANIMATED_STACK_PROPS}
              />
            ) : (
              <YStack
                key="mobile-warning-content"
                gap="$4"
                {...ANIMATED_STACK_PROPS}
              >
                {bullets.map(({ text, icon }) => (
                  <XStack key={text} gap="$3">
                    <Icon
                      name={icon}
                      size="$5"
                      color="$iconSubdued"
                      flexShrink={0}
                    />
                    <SizableText size="$bodyLg" color="$textSubdued" flex={1}>
                      {text}
                    </SizableText>
                  </XStack>
                ))}
              </YStack>
            )}
          </AnimatePresence>
        </YStack>

        <OnboardingSidebar
          gap="$4"
          $md={{ mt: 'auto' }}
          $gtMd={{ justifyContent: 'center', alignItems: 'center' }}
        >
          <AnimatePresence initial={false} exitBeforeEnter>
            {showingPhrase ? (
              <YStack
                key="sidebar-phrase-content"
                gap="$8"
                {...ANIMATED_STACK_PROPS}
              >
                {gtMd ? (
                  <CopyHintWithPhrase
                    words={recoveryPhrase}
                    onCopy={handleCopyMnemonic}
                  />
                ) : null}
                <YStack gap="$3">
                  <SizableText
                    size="$bodyMd"
                    color="$textSubdued"
                    textAlign="center"
                  >
                    {intl.formatMessage({
                      id: ETranslations.save_recovery_phrase_securely,
                    })}
                  </SizableText>
                  <Button
                    testID="onboardingv2-btn"
                    variant="primary"
                    size="large"
                    onPress={handleSavedPhrase}
                  >
                    {intl.formatMessage({
                      id: ETranslations.global_i_saved_the_phrase,
                    })}
                  </Button>
                </YStack>
              </YStack>
            ) : (
              <YStack
                key="sidebar-default-content"
                gap="$4"
                {...ANIMATED_STACK_PROPS}
              >
                {gtMd ? (
                  <SizableText
                    size="$bodyMd"
                    color="$textSubdued"
                    textAlign="center"
                  >
                    {intl.formatMessage({
                      id: ETranslations.read_information_on_the_left,
                    })}
                  </SizableText>
                ) : null}
                <Button
                  testID="onboardingv2-btn"
                  size="large"
                  variant="primary"
                  onPress={handleShowPhrase}
                >
                  {intl.formatMessage({
                    id: ETranslations.global_show_recovery_phrase,
                  })}
                </Button>
              </YStack>
            )}
          </AnimatePresence>
        </OnboardingSidebar>
      </YStack>
      {showingPhrase ? <PhraseProtection /> : null}
    </OnboardingPage>
  );
}
