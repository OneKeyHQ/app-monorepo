import { useEffect } from 'react';

import { debounce } from 'lodash';
import { useIntl } from 'react-intl';
import {
  CaptureEventType,
  CaptureProtection,
} from 'react-native-capture-protection';

import { Dialog, Icon, SizableText, Stack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

type IRecoveryPhraseProtectedDialogType =
  | 'recoveryPhrase'
  | 'sensitiveInformation';

type IUseRecoveryPhraseProtectedOptions = {
  dialogType?: IRecoveryPhraseProtectedDialogType;
  enabled?: boolean;
};

const showRecoveryPhraseProtectedDialog = (
  intl: IntlShape,
  dialogType: IRecoveryPhraseProtectedDialogType,
) => {
  const isRecoveryPhrase = dialogType === 'recoveryPhrase';
  Dialog.confirm({
    title: intl.formatMessage({
      id: isRecoveryPhrase
        ? ETranslations.recovery_phrase_screenshot_protected_title
        : ETranslations.sensitive_information_screenshot_protected__title,
    }),
    description: intl.formatMessage(
      {
        id: isRecoveryPhrase
          ? ETranslations.recovery_phrase_screenshot_protected_desc
          : ETranslations.sensitive_information_screenshot_protected__desc,
      },
      {
        tag: (chunks) =>
          (
            <SizableText color="$textCritical" size="$bodyLgMedium">
              {chunks}
            </SizableText>
          ) as unknown as string,
      },
    ),
    onConfirmText: intl.formatMessage({
      id: ETranslations.global_got_it,
    }),
    renderContent: (
      <YStack
        bg="$bgSubdued"
        borderColor="$borderSubdued"
        borderWidth="$px"
        borderRadius="$3"
        py="$5"
        ai="center"
        jc="center"
      >
        <Icon
          name="ImageWaveSolid"
          size="$6"
          color="$iconDisabled"
          position="absolute"
          top="$2"
          right="$2"
        />
        <YStack
          w={120}
          h={228}
          borderColor="$neutral3"
          borderWidth={3}
          borderRadius="$4"
          shadowColor="rgba(0, 0, 0, 0.1)"
          shadowOffset={{ width: 0, height: 2 }}
          shadowOpacity={1}
          shadowRadius={4}
          elevation={2}
          overflow="hidden"
        >
          <YStack
            flex={1}
            p="$3"
            pb={5}
            borderWidth={1}
            borderRadius="$3"
            overflow="hidden"
            borderColor="$border"
            justifyContent="flex-end"
            alignItems="center"
            bg="rgba(0, 0, 0, 0.9)"
          >
            <Stack
              h="$1"
              w={50}
              bg="rgba(255, 255, 255, 0.95)"
              borderRadius={14}
            />
          </YStack>
        </YStack>
      </YStack>
    ),
  });
};

export const useRecoveryPhraseProtected = ({
  dialogType = 'recoveryPhrase',
  enabled = true,
}: IUseRecoveryPhraseProtectedOptions = {}) => {
  const intl = useIntl();
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const debouncedShow = debounce(
      () => showRecoveryPhraseProtectedDialog(intl, dialogType),
      350,
    );
    let showTimer: ReturnType<typeof setTimeout> | undefined;

    void CaptureProtection.prevent();
    const listener = CaptureProtection.addListener(
      (eventType: CaptureEventType) => {
        if (
          eventType === CaptureEventType.CAPTURED ||
          eventType === CaptureEventType.RECORDING
        ) {
          if (showTimer) {
            clearTimeout(showTimer);
          }
          showTimer = setTimeout(() => {
            debouncedShow();
          }, 350);
        }
      },
    );
    return () => {
      if (showTimer) {
        clearTimeout(showTimer);
      }
      debouncedShow.cancel();
      void CaptureProtection.allow();
      listener?.remove();
    };
  }, [dialogType, enabled, intl]);
};
