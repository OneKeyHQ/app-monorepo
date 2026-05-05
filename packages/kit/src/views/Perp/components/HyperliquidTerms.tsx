import { useState } from 'react';

import { useIntl } from 'react-intl';

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
import { DelayedRender } from '@onekeyhq/components/src/hocs/DelayedRender';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
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
  compact,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  labelSize: '$bodyMd' | '$bodySm';
  compact?: boolean;
}) {
  return (
    <XStack
      p={compact ? '$3' : '$4'}
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
  onOpenLegalLink,
  renderDelay = 0,
}: {
  onConfirm: () => void;
  onOpenLegalLink?: () => void;
  renderDelay?: number;
}) {
  const intl = useIntl();
  const [isAccountActivatedChecked, setIsAccountActivatedChecked] =
    useState(true);
  const [isNotResponsibleChecked, setIsNotResponsibleChecked] = useState(true);

  const { hyperliquidLogo } = usePerpsLogo();

  const { gtMd } = useMedia();
  const isCompact = !gtMd;

  const confirmationSlideStyle: IYStackProps | undefined = platformEnv.isNative
    ? undefined
    : {
        zIndex: 10,
      };

  return (
    <Stack w="100%">
      <Stack
        w="100%"
        minHeight={200}
        display="flex"
        alignItems={isCompact ? 'stretch' : 'center'}
        justifyContent="center"
      >
        <DelayedRender delay={renderDelay}>
          <Stack
            w="100%"
            px={isCompact ? '$2' : '$2'}
            py="$4"
            position="relative"
          >
            <YStack w="100%" {...confirmationSlideStyle}>
              <Stack
                testID="hyperliquid-intro-confirmation-slide"
                w="100%"
                alignItems="center"
                justifyContent="center"
                px={isCompact ? '$0' : '$2'}
              >
                <YStack w="100%" gap="$2">
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
                    w="100%"
                    maxWidth="100%"
                    px={isCompact ? '$1' : '$3'}
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
                      compact={isCompact}
                    />
                    <Divider borderColor="$borderSubdued" />
                    <CustomCheckbox
                      value={isNotResponsibleChecked}
                      onChange={setIsNotResponsibleChecked}
                      label={intl.formatMessage({
                        id: ETranslations.perp_term_content_2,
                      })}
                      labelSize={gtMd ? '$bodyMd' : '$bodySm'}
                      compact={isCompact}
                    />
                  </YStack>
                </YStack>
              </Stack>
              <YStack
                w="100%"
                py="$8"
                px={gtMd ? '$4' : '$1'}
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
                      onPress={() => {
                        if (platformEnv.isDesktop || platformEnv.isNative) {
                          onOpenLegalLink?.();
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
                          onOpenLegalLink?.();
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
        </DelayedRender>
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
    let didConfirm = false;
    let hasResolved = false;
    let didTrackAgree = false;
    let didTrackReject = false;
    let didOpenLegalLink = false;
    const trackTermsAgree = () => {
      if (!didTrackAgree) {
        didTrackAgree = true;
        defaultLogger.perp.hyperliquid.perpTermsAgree();
      }
    };
    const trackTermsReject = () => {
      if (
        !didConfirm &&
        !didTrackAgree &&
        !didTrackReject &&
        !didOpenLegalLink
      ) {
        didTrackReject = true;
        defaultLogger.perp.hyperliquid.perpTermsReject();
      }
    };
    const safeResolve = (value: boolean) => {
      if (!hasResolved) {
        hasResolved = true;
        resolve(value);
      }
    };

    const dialog = Dialog.show({
      renderContent: (
        <HyperliquidTermsContent
          renderDelay={300}
          onConfirm={async () => {
            trackTermsAgree();
            try {
              await backgroundApiProxy.simpleDb.perp.setHyperliquidTermsAccepted(
                true,
              );
              didConfirm = true;
              await dialog.close();
              safeResolve(true);
            } catch {
              safeResolve(didConfirm);
            }
          }}
          onOpenLegalLink={() => {
            didOpenLegalLink = true;
            void dialog.close();
            safeResolve(false);
          }}
        />
      ),
      showExitButton: true,
      disableDrag: true,
      dismissOnOverlayPress: false,
      showFooter: false,
      contentContainerProps: platformEnv.isNative
        ? {
            px: '$3',
            pb: '$3',
          }
        : undefined,
      showCancelButton: false,
      showConfirmButton: false,
      onClose: () => {
        if (!didConfirm) {
          trackTermsReject();
          safeResolve(false);
        }
      },
    });
  });
}
