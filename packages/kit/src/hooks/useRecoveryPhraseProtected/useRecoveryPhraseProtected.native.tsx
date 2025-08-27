import { useEffect } from 'react';

import { useIntl } from 'react-intl';
import {
  CaptureEventType,
  CaptureProtection,
} from 'react-native-capture-protection';

import type { IStackProps } from '@onekeyhq/components';
import {
  Dialog,
  Icon,
  LinearGradient,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function Placeholder(props: IStackProps) {
  return <Stack bg="$neutral6" borderRadius={2} h="$1.5" {...props} />;
}

export const useRecoveryPhraseProtected = () => {
  const intl = useIntl();
  useEffect(() => {
    void CaptureProtection.prevent();
    const listener = CaptureProtection.addListener(
      (eventType: CaptureEventType) => {
        if (
          eventType === CaptureEventType.CAPTURED ||
          eventType === CaptureEventType.RECORDING
        ) {
          Dialog.confirm({
            title: intl.formatMessage({
              id: ETranslations.recovery_phrase_screenshot_protected_title,
            }),
            description: intl.formatMessage(
              {
                id: ETranslations.recovery_phrase_screenshot_protected_desc,
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
                bg="$bgApp"
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
                  bg="rgba(rgba(0, 0, 0, 0.9)"
                  p="$3"
                  pb={5}
                  w={120}
                  h={228}
                  borderColor="$neutral3"
                  borderWidth={3}
                  borderRadius="$3"
                  shadowColor="rgba(0, 0, 0, 0.1)"
                  shadowOffset={{ width: 0, height: 2 }}
                  shadowOpacity={1}
                  shadowRadius={4}
                  elevation={2}
                  justifyContent="flex-end"
                  alignItems="center"
                >
                  <Stack h="$1" w={50} bg="rgba(rgba(255, 255, 255, 0.95))" />
                </YStack>
              </YStack>
            ),
          });
        }
      },
    );
    return () => {
      void CaptureProtection.allow();
      listener?.remove();
    };
  }, [intl]);
};
