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
                    <SizableText color="$textCritical">{chunks}</SizableText>
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
                  bg="$bgApp"
                  p="$3"
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
                >
                  <Placeholder w="$10" alignSelf="center" />
                  <Placeholder w="100%" mt="$2.5" />
                  <Placeholder w="74%" mt={5} />
                  <LinearGradient
                    h={117}
                    mt="$4"
                    colors={['$critical3', '$critical5']}
                    borderColor="$borderCritical"
                    borderWidth={1}
                    borderRadius={6}
                    borderStyle="dashed"
                    shadowColor="rgba(0, 0, 0, 0.1)"
                    shadowOffset={{ width: 0, height: 2 }}
                    shadowOpacity={1}
                    shadowRadius={4}
                    ai="center"
                    jc="center"
                  >
                    <Icon
                      name="CrossedSmallSolid"
                      size="$6"
                      color="$iconCritical"
                    />
                  </LinearGradient>
                  <LinearGradient
                    h="$5"
                    mt="$4"
                    colors={['$neutral11', '$neutral12']}
                    borderColor="$neutral12"
                    borderWidth={1}
                    borderRadius={6}
                    shadowColor="rgba(0, 0, 0, 0.1)"
                    shadowOffset={{ width: 0, height: 2 }}
                    shadowOpacity={1}
                    shadowRadius={4}
                  />
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
