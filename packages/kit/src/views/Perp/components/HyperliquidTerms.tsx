import { useCallback, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import type { IYStackProps } from '@onekeyhq/components';
import {
  Button,
  Checkbox,
  Dialog,
  Divider,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { DelayedRender } from '@onekeyhq/components/src/hocs/DelayedRender';
import { PERPS_TERMS_OVERLAY_Z_INDEX } from '@onekeyhq/shared/src/consts/zIndexConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import {
  PRIVACY_POLICY_URL,
  TERMS_OF_SERVICE_URL,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePerpsLogo } from '../hooks/usePerpsLogo';

export function HyperliquidTermsContent({
  onConfirm,
  renderDelay = 0,
}: {
  onConfirm: () => void;
  renderDelay?: number;
}) {
  const intl = useIntl();
  const [isAccountActivatedChecked, setIsAccountActivatedChecked] =
    useState(false);
  const [isNotResponsibleChecked, setIsNotResponsibleChecked] = useState(false);

  const { hyperliquidLogo } = usePerpsLogo();

  const { gtMd } = useMedia();

  const confirmationSlideStyle: IYStackProps | undefined = platformEnv.isNative
    ? undefined
    : {
        zIndex: 10,
      };

  return (
    <Stack>
      <Stack
        minHeight={200}
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <DelayedRender delay={renderDelay}>
          <Stack p="$4" position="relative">
            <YStack {...confirmationSlideStyle}>
              <Stack
                testID="hyperliquid-intro-confirmation-slide"
                alignItems="center"
                justifyContent="center"
                px={gtMd ? '$4' : '$2'}
              >
                <YStack gap="$2">
                  <YStack
                    alignItems="center"
                    gap={gtMd ? '$2' : '$2'}
                    mb={gtMd ? '$1' : '$2'}
                  >
                    <Stack py={gtMd ? '$4' : '$4'} justifyContent="center">
                      <Image
                        source={hyperliquidLogo}
                        height={gtMd ? 50 : 40}
                        width={gtMd ? 300 : 250}
                        resizeMode="contain"
                      />
                    </Stack>
                    <SizableText
                      size={gtMd ? '$headingMd' : '$headingXs'}
                      textAlign="center"
                    >
                      {intl.formatMessage({
                        id: ETranslations.perp_term_title,
                      })}
                    </SizableText>
                  </YStack>

                  <YStack
                    maxWidth="100%"
                    px="$3"
                    bg="$bgSubdued"
                    borderRadius="$3"
                  >
                    <YStack alignItems="flex-start" p="$4">
                      <Checkbox
                        w="$4.5"
                        h="$4.5"
                        value={isAccountActivatedChecked}
                        onChange={(value) =>
                          setIsAccountActivatedChecked(!!value)
                        }
                        label={intl.formatMessage({
                          id: ETranslations.perp_term_content_1,
                        })}
                        labelProps={{
                          variant: gtMd ? '$bodyMd' : '$bodySm',
                        }}
                      />
                    </YStack>
                    <Divider borderColor="$borderSubdued" />
                    <YStack alignItems="flex-start" p="$4">
                      <Checkbox
                        w="$4.5"
                        h="$4.5"
                        value={isNotResponsibleChecked}
                        onChange={(value) =>
                          setIsNotResponsibleChecked(!!value)
                        }
                        label={intl.formatMessage({
                          id: ETranslations.perp_term_content_2,
                        })}
                        labelProps={{
                          variant: gtMd ? '$bodyMd' : '$bodySm',
                        }}
                      />
                    </YStack>
                  </YStack>
                </YStack>
              </Stack>
              <YStack
                py="$8"
                px={gtMd ? '$4' : '$2'}
                justifyContent="center"
                pb={gtMd ? '$3' : '$1'}
                gap="$1"
              >
                <Button
                  variant="primary"
                  size="medium"
                  w="100%"
                  onPress={onConfirm}
                  disabled={
                    !isAccountActivatedChecked || !isNotResponsibleChecked
                  }
                >
                  {intl.formatMessage({
                    id: ETranslations.perp_term_agree,
                  })}
                </Button>

                <XStack justifyContent="center" pt="$2">
                  <SizableText
                    size="$bodySm"
                    color="$textSubdued"
                    textAlign="center"
                  >
                    {intl.formatMessage({
                      id: ETranslations.perp_term_content_3,
                    })}{' '}
                    <SizableText
                      size="$bodySm"
                      color="$textInteractive"
                      cursor="pointer"
                      onPress={() => {
                        openUrlExternal(TERMS_OF_SERVICE_URL);
                      }}
                      hoverStyle={{
                        borderBottomWidth: 1,
                        borderBottomColor: '$textInteractive',
                      }}
                      pressStyle={{
                        borderBottomWidth: 1,
                        borderBottomColor: '$textInteractive',
                      }}
                    >
                      {intl.formatMessage({
                        id: ETranslations.settings_user_agreement,
                      })}
                    </SizableText>{' '}
                    {intl.formatMessage({
                      id: ETranslations.perp_term_content_4,
                    })}{' '}
                    <SizableText
                      cursor="pointer"
                      hoverStyle={{
                        borderBottomWidth: 1,
                        borderBottomColor: '$textInteractive',
                      }}
                      pressStyle={{
                        borderBottomWidth: 1,
                        borderBottomColor: '$textInteractive',
                      }}
                      size="$bodySm"
                      color="$textInteractive"
                      onPress={() => {
                        openUrlExternal(PRIVACY_POLICY_URL);
                      }}
                    >
                      {intl.formatMessage({
                        id: ETranslations.global_privacy_policy,
                      })}
                    </SizableText>
                  </SizableText>
                </XStack>
              </YStack>
            </YStack>
          </Stack>
        </DelayedRender>
      </Stack>
    </Stack>
  );
}

export function HyperliquidTermsOverlay() {
  const [isVisible, setIsVisible] = useState(false);

  const handleConfirm = useCallback(() => {
    setIsVisible(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const checkTermsAccepted = async () => {
        const isTermsAccepted =
          await backgroundApiProxy.simpleDb.perp.getHyperliquidTermsAccepted();
        if (!isTermsAccepted) {
          setTimeout(() => {
            setIsVisible(true);
          }, 600);
        }
      };
      void checkTermsAccepted();
    }, []),
  );
  const { width } = useWindowDimensions();
  const { gtMd } = useMedia();
  if (!isVisible) {
    return null;
  }

  return (
    <Stack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg="$bgBackdrop"
      zIndex={PERPS_TERMS_OVERLAY_Z_INDEX}
      alignItems="center"
      justifyContent="center"
      p="$6"
    >
      <Stack
        width={Math.min(gtMd ? 460 : 320, width)}
        bg="$bgApp"
        borderRadius="$4"
        overflow="hidden"
      >
        <HyperliquidTermsContent
          onConfirm={async () => {
            await backgroundApiProxy.simpleDb.perp.setHyperliquidTermsAccepted(
              true,
            );
            handleConfirm();
          }}
        />
      </Stack>
    </Stack>
  );
}

export async function showHyperliquidTermsDialog() {
  const isTermsAccepted =
    await backgroundApiProxy.simpleDb.perp.getHyperliquidTermsAccepted();
  if (isTermsAccepted) {
    return;
  }

  const dialog = Dialog.show({
    // title: 'Hyperliquid Introduction',
    renderContent: (
      <HyperliquidTermsContent
        renderDelay={300}
        onConfirm={async () => {
          await dialog.close();
          await backgroundApiProxy.simpleDb.perp.setHyperliquidTermsAccepted(
            true,
          );
        }}
      />
    ),
    showExitButton: false,
    disableDrag: true,
    dismissOnOverlayPress: false,
    showFooter: false,
    showCancelButton: false,
    showConfirmButton: false,
  });

  return dialog;
}
