import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Divider,
  IconButton,
  Illustration,
  LottieView,
  Page,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useClipboard } from '@onekeyhq/components/src/hooks/useClipboard';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalWebViewRoutes } from '@onekeyhq/shared/src/routes';
import type {
  EModalAddressRiskCheckRoutes,
  IModalAddressRiskCheckParamList,
} from '@onekeyhq/shared/src/routes/addressRiskCheck';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import type { IAddressRiskCheckResult } from '@onekeyhq/shared/types/addressRiskCheck';
import { EKytRiskLevel } from '@onekeyhq/shared/types/kyt';

import { AddressRiskMoreAnalysis } from '../components/AddressRiskMoreAnalysis';
import {
  CardRow,
  LEVEL_TEXT_COLOR,
  RiskFactorCard,
} from '../components/RiskCheckShared';
import { executeAddressRiskCheck } from '../hooks/useCheckAddressRisk';

import type { RouteProp } from '@react-navigation/core';

const ADDRESS_RISK_LEVEL_CONTENT: Record<
  EKytRiskLevel,
  {
    title: ETranslations;
    description: ETranslations;
  }
> = {
  [EKytRiskLevel.None]: {
    title: ETranslations.address_risk_check_level_none__title,
    description: ETranslations.address_risk_check_level_none__desc,
  },
  [EKytRiskLevel.Checking]: {
    title: ETranslations.address_risk_check_level_checking__title,
    description: ETranslations.address_risk_check_level_checking__desc,
  },
  [EKytRiskLevel.Failed]: {
    title: ETranslations.address_risk_check_level_failed__title,
    description: ETranslations.address_risk_check_level_failed__desc,
  },
  [EKytRiskLevel.Low]: {
    title: ETranslations.address_risk_check_level_low__title,
    description: ETranslations.address_risk_check_level_low__desc,
  },
  [EKytRiskLevel.Moderate]: {
    title: ETranslations.address_risk_check_level_moderate__title,
    description: ETranslations.address_risk_check_level_moderate__desc,
  },
  [EKytRiskLevel.High]: {
    title: ETranslations.address_risk_check_level_high__title,
    description: ETranslations.address_risk_check_level_high__desc,
  },
  [EKytRiskLevel.Severe]: {
    title: ETranslations.address_risk_check_level_severe__title,
    description: ETranslations.address_risk_check_level_severe__desc,
  },
};

function AddressRiskCheckResultContent({
  result,
  showMoreAnalysis,
  onContinue,
}: {
  result: IAddressRiskCheckResult;
  showMoreAnalysis: boolean;
  onContinue?: () => void | Promise<void>;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { copyText } = useClipboard();
  const [showAllFactors, setShowAllFactors] = useState(false);
  const canContinueToSend =
    Boolean(onContinue) &&
    !showMoreAnalysis &&
    [EKytRiskLevel.None, EKytRiskLevel.Low, EKytRiskLevel.Moderate].includes(
      result.level,
    );

  const { result: network } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNetwork.getNetworkSafe({
        networkId: result.networkId,
      }),
    [result.networkId],
  );

  const checkedAtText = formatDate(new Date(result.checkedAt * 1000));
  const levelContent = ADDRESS_RISK_LEVEL_CONTENT[result.level];
  const visibleFactors = showAllFactors
    ? result.reasons
    : result.reasons.slice(0, 3);
  const hasMoreFactors = !showAllFactors && result.reasons.length > 3;

  // Only trust HTTPS report links from the backend — defense in depth against a
  // tampered/compromised response opening a deep link or phishing page.
  const canViewReport = useMemo(
    () =>
      Boolean(result.reportUrl) &&
      uriUtils.parseUrl(result.reportUrl ?? '')?.urlSchema === 'https',
    [result.reportUrl],
  );

  const handleViewReport = useCallback(() => {
    if (!canViewReport || !result.reportUrl) {
      return;
    }
    navigation.pushModal(EModalRoutes.WebViewModal, {
      screen: EModalWebViewRoutes.WebView,
      params: {
        url: result.reportUrl,
        title: intl.formatMessage({
          id: ETranslations.kyt_view_report__action,
        }),
      },
    });
  }, [canViewReport, intl, navigation, result.reportUrl]);

  const handleCopyAddress = useCallback(() => {
    copyText(result.address);
  }, [copyText, result.address]);

  const handleClose = useCallback(
    (extra?: { flag?: string }) => {
      if (extra?.flag === 'continueSend') {
        void onContinue?.();
      }
    },
    [onContinue],
  );

  const handleContinueToSend = useCallback(
    (
      _close: (extra?: { flag?: string }) => void,
      closePageStack: (extra?: { flag?: string }) => void,
    ) => {
      closePageStack({ flag: 'continueSend' });
    },
    [],
  );

  return (
    <Page onClose={handleClose}>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.address_risk_check__title,
        })}
      />
      <Page.Body>
        <ScrollView>
          <YStack gap="$4" pb="$5">
            <YStack gap="$4" padding="$5">
              <YStack gap="$0.5">
                <SizableText
                  size="$heading2xl"
                  color={LEVEL_TEXT_COLOR[result.level] ?? '$text'}
                  numberOfLines={2}
                >
                  {intl.formatMessage({
                    id: levelContent.title,
                  })}
                </SizableText>
                <SizableText
                  size="$bodyMd"
                  color="$textSubdued"
                  numberOfLines={2}
                >
                  {intl.formatMessage({
                    id: levelContent.description,
                  })}
                </SizableText>
              </YStack>

              <YStack
                borderWidth={StyleSheet.hairlineWidth}
                borderColor="$borderSubdued"
                borderRadius="$3"
                overflow="hidden"
              >
                {network?.name ? (
                  <>
                    <CardRow
                      label={intl.formatMessage({
                        id: ETranslations.global_network,
                      })}
                    >
                      <XStack
                        ai="center"
                        jc="flex-end"
                        gap="$1.5"
                        maxWidth="70%"
                        flexShrink={1}
                      >
                        <NetworkAvatar networkId={result.networkId} size="$5" />
                        <SizableText
                          size="$bodyMdMedium"
                          textAlign="right"
                          numberOfLines={1}
                          flexShrink={1}
                        >
                          {network.name}
                        </SizableText>
                      </XStack>
                    </CardRow>
                    <Divider />
                  </>
                ) : null}

                <CardRow
                  label={intl.formatMessage({
                    id: ETranslations.global_address,
                  })}
                >
                  <XStack
                    ai="center"
                    jc="flex-end"
                    gap="$1"
                    maxWidth="70%"
                    flexShrink={1}
                  >
                    <SizableText
                      size="$bodyMdMedium"
                      numberOfLines={2}
                      textAlign="right"
                      flexShrink={1}
                      style={
                        platformEnv.isNative
                          ? undefined
                          : { wordBreak: 'break-all' }
                      }
                    >
                      {result.address}
                    </SizableText>
                    <IconButton
                      testID="address-risk-check-copy-address"
                      title={intl.formatMessage({
                        id: ETranslations.global_copy_address,
                      })}
                      variant="tertiary"
                      size="small"
                      iconSize="$4"
                      icon="Copy3Outline"
                      onPress={handleCopyAddress}
                    />
                  </XStack>
                </CardRow>

                <Divider />
                <CardRow
                  label={intl.formatMessage({
                    id: ETranslations.kyt_last_checked__title,
                  })}
                >
                  <SizableText
                    size="$bodyMdMedium"
                    textAlign="right"
                    numberOfLines={1}
                    flexShrink={1}
                  >
                    {checkedAtText}
                  </SizableText>
                </CardRow>
              </YStack>
            </YStack>

            {result.reasons.length > 0 ? (
              <YStack px="$5" gap="$2">
                <XStack ai="center" jc="space-between">
                  <SizableText size="$headingSm" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.kyt_risk_factors__title,
                    })}
                  </SizableText>
                  <SizableText size="$bodyMdMedium" color="$textSubdued">
                    {intl.formatMessage(
                      { id: ETranslations.kyt_risk_factors_found__msg },
                      { count: result.reasons.length },
                    )}
                  </SizableText>
                </XStack>
                <YStack gap="$1">
                  {visibleFactors.map((factor, index) => (
                    <RiskFactorCard key={index} factor={factor} />
                  ))}
                </YStack>
                {hasMoreFactors ? (
                  <Button
                    testID="address-risk-check-show-more-factors"
                    size="small"
                    variant="tertiary"
                    alignSelf="flex-start"
                    cursor="default"
                    onPress={() => setShowAllFactors(true)}
                  >
                    {intl.formatMessage({
                      id: ETranslations.global_show_more,
                    })}
                  </Button>
                ) : null}
              </YStack>
            ) : null}

            {canViewReport ? (
              <YStack px="$5">
                <Button
                  testID="address-risk-check-view-report"
                  variant="secondary"
                  size="large"
                  iconAfter="ArrowTopRightOutline"
                  onPress={handleViewReport}
                >
                  {intl.formatMessage({
                    id: ETranslations.kyt_view_report__action,
                  })}
                </Button>
              </YStack>
            ) : null}

            {showMoreAnalysis ? (
              <YStack px="$5">
                <AddressRiskMoreAnalysis
                  networkId={result.networkId}
                  address={result.address}
                />
              </YStack>
            ) : null}
          </YStack>
        </ScrollView>
      </Page.Body>
      {canContinueToSend ? (
        <Page.Footer>
          <Page.FooterActions
            onConfirm={handleContinueToSend}
            onConfirmText={intl.formatMessage({
              id: ETranslations.continue_to_send__action,
            })}
            confirmButtonProps={{
              testID: 'address-risk-check-send-action',
            }}
          />
        </Page.Footer>
      ) : null}
    </Page>
  );
}

function AddressRiskCheckPending({ isFailed }: { isFailed: boolean }) {
  const intl = useIntl();

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.address_risk_check__title,
        })}
      />
      <Page.Body>
        <YStack
          minHeight={320}
          flex={1}
          alignItems="center"
          justifyContent="center"
          gap="$5"
          px="$5"
          py="$8"
        >
          {isFailed ? (
            <Illustration size={110} name="XMark" />
          ) : (
            <LottieView
              source={require('@onekeyhq/kit/assets/animations/swap_order_pending.json')}
              width={110}
              height={110}
              autoPlay
              loop
            />
          )}
          <YStack gap="$2" alignItems="center" maxWidth={360}>
            <SizableText size="$headingLg" textAlign="center">
              {intl.formatMessage({
                id: isFailed
                  ? ETranslations.address_risk_check_level_failed__title
                  : ETranslations.address_risk_check_level_checking__title,
              })}
            </SizableText>
            <SizableText size="$bodyLg" textAlign="center" color="$textSubdued">
              {intl.formatMessage({
                id: isFailed
                  ? ETranslations.address_risk_check_level_failed__desc
                  : ETranslations.address_risk_check_loading__desc,
              })}
            </SizableText>
          </YStack>
        </YStack>
      </Page.Body>
    </Page>
  );
}

function AddressRiskCheckResult() {
  const route =
    useRoute<
      RouteProp<
        IModalAddressRiskCheckParamList,
        EModalAddressRiskCheckRoutes.AddressRiskCheckResult
      >
    >();
  const { checkRequest, showMoreAnalysis, onContinue } = route.params;
  const [result, setResult] = useState<IAddressRiskCheckResult | undefined>(
    route.params.result,
  );
  const [isFailed, setIsFailed] = useState(false);
  const requestNetworkId = checkRequest?.networkId;
  const requestAddress = checkRequest?.address;

  useEffect(() => {
    if (!requestNetworkId || !requestAddress) {
      return;
    }
    let isActive = true;
    setIsFailed(false);
    void executeAddressRiskCheck({
      networkId: requestNetworkId,
      address: requestAddress,
      entryPoint: 'sendAddressInput',
    }).then(
      (nextResult) => {
        if (isActive) {
          setResult(nextResult);
        }
      },
      () => {
        if (isActive) {
          setIsFailed(true);
        }
      },
    );
    return () => {
      isActive = false;
    };
  }, [requestAddress, requestNetworkId]);

  if (!result) {
    return <AddressRiskCheckPending isFailed={isFailed} />;
  }

  return (
    <AddressRiskCheckResultContent
      result={result}
      showMoreAnalysis={showMoreAnalysis}
      onContinue={onContinue}
    />
  );
}

export default AddressRiskCheckResult;
