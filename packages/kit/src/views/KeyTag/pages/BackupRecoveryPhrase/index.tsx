import { useCallback, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  HeightTransition,
  KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET,
  Page,
  Portal,
  SizableText,
  YStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  OnboardingHeading,
  OnboardingIconBadge,
  OnboardingPage,
  OnboardingSidebar,
} from '@onekeyhq/kit/src/views/Onboardingv2/components/Layout';
import { PhaseInputArea } from '@onekeyhq/kit/src/views/Onboardingv2/components/PhaseInputArea';
import type { IPhaseInputAreaInstance } from '@onekeyhq/kit/src/views/Onboardingv2/components/PhaseInputArea';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';

const faqs = [
  {
    titleId: ETranslations.faq_recovery_phrase,
    descId: ETranslations.faq_recovery_phrase_explaination,
  },
  {
    titleId: ETranslations.faq_recovery_phrase_safe_store,
    descId: ETranslations.faq_recovery_phrase_safe_store_desc,
  },
] as const;

export function ImportRecoveryPhrase() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const phaseInputAreaRef = useRef<IPhaseInputAreaInstance | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (!phaseInputAreaRef.current) {
      return;
    }
    setIsConfirming(true);
    try {
      const { mnemonic } = await phaseInputAreaRef.current.submit();
      navigation.push(EOnboardingPagesV2.KeyTagBackupDotMap, {
        encodedText: mnemonic,
        title: '',
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsConfirming(false);
    }
  }, [navigation]);

  const sidebar = useMemo(
    () => (
      <YStack gap="$6">
        {faqs.map((item) => (
          <YStack key={item.titleId} gap="$1">
            <SizableText size="$bodyLgMedium">
              {intl.formatMessage({ id: item.titleId })}
            </SizableText>
            <SizableText size="$bodyLg" color="$textSubdued">
              {intl.formatMessage({ id: item.descId })}
            </SizableText>
          </YStack>
        ))}
      </YStack>
    ),
    [intl],
  );

  return (
    <OnboardingPage
      showLanguageSelector={false}
      scrollable
      keyboardBottomOffset={KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET + 80}
    >
      <YStack $gtMd={{ flexDirection: 'row' }}>
        <YStack gap="$8" $gtMd={{ flex: 1, gap: '$12' }}>
          <OnboardingHeading>
            {intl.formatMessage({
              id: ETranslations.global_enter_recovery_phrase,
            })}
          </OnboardingHeading>
          <YStack gap="$5" pb="$5">
            <PhaseInputArea
              ref={phaseInputAreaRef as RefObject<IPhaseInputAreaInstance>}
              defaultPhrases={[]}
            />
            {gtMd ? (
              <Button
                size="large"
                variant="primary"
                onPress={handleConfirm}
                loading={isConfirming}
                testID="keytag-enter-phrase-confirm-btn"
              >
                {intl.formatMessage({ id: ETranslations.global_confirm })}
              </Button>
            ) : null}
          </YStack>
        </YStack>
        {gtMd ? (
          <OnboardingSidebar>
            <OnboardingIconBadge icon="DotHorSolid" />
            {sidebar}
          </OnboardingSidebar>
        ) : null}
      </YStack>
      {!gtMd ? (
        <Page.Footer>
          <Page.FooterActions
            pb={safeAreaBottom ? safeAreaBottom + 8 : 20}
            onConfirmText={intl.formatMessage({
              id: ETranslations.global_confirm,
            })}
            confirmButtonProps={{
              onPress: handleConfirm,
              loading: isConfirming,
              testID: 'keytag-enter-phrase-confirm-btn',
            }}
          >
            <HeightTransition>
              <Portal.Container name={Portal.Constant.SUGGESTION_LIST} />
            </HeightTransition>
          </Page.FooterActions>
        </Page.Footer>
      ) : null}
    </OnboardingPage>
  );
}

export default ImportRecoveryPhrase;
