import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { Dimensions, PixelRatio, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IYStackProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Divider,
  Icon,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  openUrlExternal,
  openUrlInDiscovery,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import {
  PRIVACY_POLICY_URL,
  TERMS_OF_SERVICE_URL,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePerpsLogo } from '../hooks/usePerpsLogo';

function CustomCheckbox({
  value,
  onChange,
  label,
  labelSize,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  labelSize: '$bodyMd' | '$bodySm';
}) {
  return (
    <XStack
      p="$4"
      gap="$3"
      alignItems="center"
      onPress={() => onChange(!value)}
      cursor="default"
      hoverStyle={{
        opacity: 0.8,
      }}
      pressStyle={{
        opacity: 0.6,
      }}
    >
      <Stack
        width={16}
        height={16}
        borderRadius="$1"
        borderWidth="$px"
        borderColor={value ? '$borderActive' : '$borderSubdued'}
        bg={value ? '$bgPrimary' : '$bg'}
        justifyContent="center"
        alignItems="center"
      >
        {value ? (
          <Icon name="CheckLargeOutline" size="$2.5" color="$iconInverse" />
        ) : null}
      </Stack>
      <SizableText flex={1} size={labelSize} color="$text">
        {label}
      </SizableText>
    </XStack>
  );
}

export function HyperliquidTermsContent({
  onConfirm,
  onClose,
}: {
  onConfirm: () => void;
  onClose?: () => void;
}) {
  const intl = useIntl();
  const [isAccountActivatedChecked, setIsAccountActivatedChecked] =
    useState(true);
  const [isNotResponsibleChecked, setIsNotResponsibleChecked] = useState(true);

  const { hyperliquidLogo } = usePerpsLogo();

  const { gtMd } = useMedia();
  const safeAreaInsets = useSafeAreaInsets();

  const layoutData = useRef<{
    outerContainer?: { height: number; width: number; y: number };
    content?: { height: number; width: number; y: number };
    footer?: { height: number; width: number; y: number };
    disclaimer?: { height: number; width: number; y: number };
  }>({});
  const loggedRef = useRef(false);

  const tryLogLayout = useCallback(() => {
    const d = layoutData.current;
    if (!d.outerContainer || !d.content || !d.footer || !d.disclaimer) return;
    if (loggedRef.current) return;
    loggedRef.current = true;

    const screen = Dimensions.get('screen');
    const window = Dimensions.get('window');

    defaultLogger.perp.dialogLayout.termsDialogLayout({
      screenWidth: screen.width,
      screenHeight: screen.height,
      windowWidth: window.width,
      windowHeight: window.height,
      safeAreaTop: safeAreaInsets.top,
      safeAreaBottom: safeAreaInsets.bottom,
      safeAreaLeft: safeAreaInsets.left,
      safeAreaRight: safeAreaInsets.right,
      outerContainerHeight: d.outerContainer.height,
      outerContainerWidth: d.outerContainer.width,
      outerContainerY: d.outerContainer.y,
      contentHeight: d.content.height,
      contentWidth: d.content.width,
      contentY: d.content.y,
      footerHeight: d.footer.height,
      footerWidth: d.footer.width,
      footerY: d.footer.y,
      disclaimerHeight: d.disclaimer.height,
      disclaimerWidth: d.disclaimer.width,
      disclaimerY: d.disclaimer.y,
      disclaimerBottomEdge: d.disclaimer.y + d.disclaimer.height,
      visibleBottomEdge: screen.height - safeAreaInsets.bottom,
      isDisclaimerFullyVisible:
        d.disclaimer.y + d.disclaimer.height <=
        screen.height - safeAreaInsets.bottom,
      pixelRatio: PixelRatio.get(),
      fontScale: PixelRatio.getFontScale(),
      platform: Platform.OS,
      osVersion: String(Platform.Version),
    });
  }, [safeAreaInsets]);

  const confirmationSlideStyle: IYStackProps | undefined = platformEnv.isNative
    ? undefined
    : {
        zIndex: 10,
      };

  return (
    <Stack
      onLayout={(e) => {
        const { height, width } = e.nativeEvent.layout;
        e.target.measureInWindow((x, y) => {
          layoutData.current.outerContainer = { height, width, y };
          tryLogLayout();
        });
      }}
    >
      <Stack
        minHeight={200}
        display="flex"
        alignItems="center"
        justifyContent="center"
        onLayout={(e) => {
          const { height, width } = e.nativeEvent.layout;
          e.target.measureInWindow((x, y) => {
            layoutData.current.content = { height, width, y };
            tryLogLayout();
          });
        }}
      >
          <Stack px="$2" py="$4" position="relative">
            <YStack {...confirmationSlideStyle}>
              <Stack
                testID="hyperliquid-intro-confirmation-slide"
                alignItems="center"
                justifyContent="center"
                px="$2"
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
                    <CustomCheckbox
                      value={isAccountActivatedChecked}
                      onChange={setIsAccountActivatedChecked}
                      label={intl.formatMessage({
                        id: ETranslations.perp_term_content_1,
                      })}
                      labelSize={gtMd ? '$bodyMd' : '$bodySm'}
                    />
                    <Divider borderColor="$borderSubdued" />
                    <CustomCheckbox
                      value={isNotResponsibleChecked}
                      onChange={setIsNotResponsibleChecked}
                      label={intl.formatMessage({
                        id: ETranslations.perp_term_content_2,
                      })}
                      labelSize={gtMd ? '$bodyMd' : '$bodySm'}
                    />
                  </YStack>
                </YStack>
              </Stack>
              <YStack
                py="$8"
                px={gtMd ? '$4' : '$2'}
                justifyContent="center"
                pb={gtMd ? '$3' : '$1'}
                gap="$1"
                onLayout={(e) => {
                  const { height, width } = e.nativeEvent.layout;
                  e.target.measureInWindow((x, y) => {
                    layoutData.current.footer = { height, width, y };
                    tryLogLayout();
                  });
                }}
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

                <XStack
                  justifyContent="center"
                  pt="$2"
                  onLayout={(e) => {
                    const { height, width } = e.nativeEvent.layout;
                    e.target.measureInWindow((x, y) => {
                      layoutData.current.disclaimer = { height, width, y };
                      tryLogLayout();
                    });
                  }}
                >
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
                      onPress={() => {
                        if (platformEnv.isDesktop || platformEnv.isNative) {
                          onClose?.();
                          openUrlInDiscovery({ url: TERMS_OF_SERVICE_URL });
                        } else {
                          openUrlExternal(TERMS_OF_SERVICE_URL);
                        }
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
                        if (platformEnv.isDesktop || platformEnv.isNative) {
                          onClose?.();
                          openUrlInDiscovery({ url: PRIVACY_POLICY_URL });
                        } else {
                          openUrlExternal(PRIVACY_POLICY_URL);
                        }
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
      </Stack>
    </Stack>
  );
}

export async function showHyperliquidTermsDialog(): Promise<boolean> {
  const isTermsAccepted =
    await backgroundApiProxy.simpleDb.perp.getHyperliquidTermsAccepted();
  if (isTermsAccepted) {
    return true;
  }

  return new Promise((resolve) => {
    const dialog = Dialog.show({
      renderContent: (
        <HyperliquidTermsContent
          onConfirm={async () => {
            await backgroundApiProxy.simpleDb.perp.setHyperliquidTermsAccepted(
              true,
            );
            await dialog.close();
            resolve(true);
          }}
          onClose={() => {
            void dialog.close();
            resolve(false);
          }}
        />
      ),
      showExitButton: true,
      disableDrag: true,
      dismissOnOverlayPress: false,
      showFooter: false,
      showCancelButton: false,
      showConfirmButton: false,
      onClose: () => {
        resolve(false);
      },
    });
  });
}
