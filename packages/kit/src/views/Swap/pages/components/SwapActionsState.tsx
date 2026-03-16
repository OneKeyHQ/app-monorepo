import { memo, useCallback, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Icon,
  LottieView,
  Page,
  SizableText,
  Stack,
  XStack,
  resetToRoute,
  useIsOverlayPage,
  useMedia,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import {
  useSwapActions,
  useSwapProviderSupportReceiveAddressAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import {
  useSettingsAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EOnboardingPages,
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  ESwapDirectionType,
  ESwapQuoteKind,
} from '@onekeyhq/shared/types/swap/types';

import {
  useSwapAddressInfo,
  useSwapRecipientAddressInfo,
} from '../../hooks/useSwapAccount';
import {
  useSwapActionState,
  useSwapQuoteEventFetching,
  useSwapQuoteLoading,
  useSwapSlippagePercentageModeInfo,
} from '../../hooks/useSwapState';

import { PercentageStageOnKeyboard } from './SwapInputContainer';

interface ISwapActionsStateProps {
  onPreSwap: () => void;
  onOpenRecipientAddress: () => void;
  onSelectPercentageStage?: (stage: number) => void;
}

function PageFooter({
  actionComponent,
  isModalPage,
  md,
  onSelectPercentageStage,
}: {
  onSelectPercentageStage?: (stage: number) => void;
  isModalPage: boolean;
  md: boolean;
  actionComponent: React.JSX.Element;
}) {
  return (
    <Page.Footer>
      <Page.FooterActions
        {...(isModalPage && !md ? { buttonContainerProps: { flex: 1 } } : {})}
        confirmButton={actionComponent}
      />
      {!platformEnv.isNativeIOS ? (
        <PercentageStageOnKeyboard
          onSelectPercentageStage={onSelectPercentageStage}
        />
      ) : null}
    </Page.Footer>
  );
}

const SwapActionsState = ({
  onPreSwap,
  onOpenRecipientAddress,
  onSelectPercentageStage,
}: ISwapActionsStateProps) => {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [currentQuoteRes] = useSwapQuoteCurrentSelectAtom();
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const swapToAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const { quoteAction } = useSwapActions().current;
  const swapActionState = useSwapActionState();
  const { slippageItem } = useSwapSlippagePercentageModeInfo();
  const swapSlippageRef = useRef(slippageItem);
  const hasEverShownCostSavingsRef = useRef(false);
  const [swapProviderSupportReceiveAddress] =
    useSwapProviderSupportReceiveAddressAtom();
  const [{ swapEnableRecipientAddress }] = useSettingsAtom();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const quoteLoading = useSwapQuoteLoading();
  const swapRecipientAddressInfo = useSwapRecipientAddressInfo(
    swapEnableRecipientAddress,
  );
  if (swapSlippageRef.current !== slippageItem) {
    swapSlippageRef.current = slippageItem;
  }
  const themeVariant = useThemeVariant();
  const quoting = useSwapQuoteEventFetching();

  const isModalPage = useIsOverlayPage();
  const { md } = useMedia();

  const onActionHandlerBefore = useCallback(async () => {
    if (swapActionState.noConnectWallet) {
      if (platformEnv.isWebDappMode) {
        navigation.pushModal(EModalRoutes.OnboardingModal, {
          screen: EOnboardingPages.ConnectWalletOptions,
        });
      } else {
        resetToRoute(ERootRoutes.Onboarding, {
          screen: EOnboardingV2Routes.OnboardingV2,
          params: {
            screen: EOnboardingPagesV2.GetStarted,
          },
        });
      }
      return;
    }
    if (swapActionState.isRefreshQuote) {
      void quoteAction(
        swapSlippageRef.current,
        swapFromAddressInfo?.address,
        swapFromAddressInfo?.accountInfo?.account?.id,
        undefined,
        undefined,
        currentQuoteRes?.kind ?? ESwapQuoteKind.SELL,
        true,
        swapToAddressInfo?.address,
      );
      return;
    }
    onPreSwap();
  }, [
    currentQuoteRes?.kind,
    navigation,
    onPreSwap,
    quoteAction,
    swapActionState.isRefreshQuote,
    swapActionState.noConnectWallet,
    swapFromAddressInfo?.accountInfo?.account?.id,
    swapFromAddressInfo?.address,
    swapToAddressInfo?.address,
  ]);

  const shouldShowRecipient = useMemo(
    () =>
      swapEnableRecipientAddress &&
      swapProviderSupportReceiveAddress &&
      fromToken &&
      toToken &&
      currentQuoteRes?.toTokenInfo.networkId === toToken.networkId,
    [
      swapEnableRecipientAddress,
      currentQuoteRes?.toTokenInfo.networkId,
      swapProviderSupportReceiveAddress,
      fromToken,
      toToken,
    ],
  );

  const recipientComponent = useMemo(() => {
    if (shouldShowRecipient) {
      return (
        <XStack gap="$1" {...(isModalPage && !md ? { flex: 1 } : { pb: '$4' })}>
          <Stack>
            <Icon name="AddedPeopleOutline" w="$5" h="$5" />
          </Stack>
          <XStack flex={1} flexWrap="wrap" gap="$1">
            <SizableText flexShrink={0} size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.swap_page_recipient_send_to,
              })}
            </SizableText>
            <SizableText
              flexShrink={0}
              size="$bodyMd"
              cursor="pointer"
              textDecorationLine="underline"
              onPress={onOpenRecipientAddress}
            >
              {swapRecipientAddressInfo?.showAddress ??
                intl.formatMessage({
                  id: ETranslations.swap_page_recipient_add,
                })}
            </SizableText>
            {swapRecipientAddressInfo?.showAddress ? (
              <SizableText
                numberOfLines={1}
                flexShrink={0}
                size="$bodyMd"
                color="$textSubdued"
              >
                {`(${
                  !swapRecipientAddressInfo?.isExtAccount
                    ? `${
                        swapRecipientAddressInfo?.accountInfo?.walletName ?? ''
                      }-${
                        swapRecipientAddressInfo?.accountInfo?.accountName ?? ''
                      }`
                    : intl.formatMessage({
                        id: ETranslations.swap_page_recipient_external_account,
                      })
                })`}
              </SizableText>
            ) : null}
          </XStack>
        </XStack>
      );
    }
    return null;
  }, [
    intl,
    md,
    onOpenRecipientAddress,
    isModalPage,
    shouldShowRecipient,
    swapRecipientAddressInfo?.accountInfo?.accountName,
    swapRecipientAddressInfo?.accountInfo?.walletName,
    swapRecipientAddressInfo?.isExtAccount,
    swapRecipientAddressInfo?.showAddress,
  ]);

  const costSavingsComponent = useMemo(() => {
    const hasCostSavings =
      currentQuoteRes?.fee?.costSavings &&
      new BigNumber(currentQuoteRes?.fee?.costSavings || 0).gt(0);

    if (hasCostSavings) {
      const isLoadingQuote = quoting || quoteLoading;
      const shouldShow = hasEverShownCostSavingsRef.current || !isLoadingQuote;

      if (shouldShow) {
        if (!hasEverShownCostSavingsRef.current) {
          hasEverShownCostSavingsRef.current = true;
        }

        const formattedFee = numberFormat(
          currentQuoteRes.fee?.costSavings ?? '0',
          {
            formatter: 'value',
            formatterOptions: {
              currency: settingsPersistAtom.currencyInfo.symbol,
            },
          },
        );

        return (
          <Badge
            badgeSize="sm"
            badgeType="success"
            alignSelf="center"
            gap="$1.5"
          >
            <Icon name="PartyCelebrateSolid" size="$3" color="$iconSuccess" />
            <SizableText size="$bodySmMedium" color="$textSuccess">
              {intl.formatMessage(
                { id: ETranslations.swap_fee_save },
                { fee: formattedFee },
              )}
            </SizableText>
          </Badge>
        );
      }
    } else {
      hasEverShownCostSavingsRef.current = false;
    }
    return null;
  }, [
    currentQuoteRes?.fee?.costSavings,
    settingsPersistAtom.currencyInfo.symbol,
    quoting,
    quoteLoading,
    intl,
  ]);

  const actionComponent = useMemo(
    () => (
      <Stack
        flex={1}
        {...(isModalPage && !md
          ? {
              flexDirection: 'row',
              justifyContent: shouldShowRecipient
                ? 'space-between'
                : 'flex-end',
              alignItems: 'center',
            }
          : {})}
      >
        {recipientComponent}
        <Stack gap="$2">
          {/* In modal: show savings above button; In non-modal: show below */}
          {isModalPage && !md ? costSavingsComponent : null}
          <Button
            onPress={onActionHandlerBefore}
            size={isModalPage && !md ? 'medium' : 'large'}
            variant="primary"
            disabled={swapActionState.disabled || swapActionState.isLoading}
            borderRadius="$full"
          >
            {quoting || quoteLoading ? (
              <LottieView
                source={
                  themeVariant === 'light'
                    ? require('@onekeyhq/kit/assets/animations/swap_quote_loading_light.json')
                    : require('@onekeyhq/kit/assets/animations/swap_quote_loading_dark.json')
                }
                autoPlay
                loop
                style={{
                  width: 40,
                  height: 24,
                }}
              />
            ) : (
              swapActionState.label
            )}
          </Button>
          {/* In non-modal: show savings below button */}
          {!isModalPage || md ? costSavingsComponent : null}
        </Stack>
      </Stack>
    ),
    [
      md,
      onActionHandlerBefore,
      isModalPage,
      quoteLoading,
      quoting,
      recipientComponent,
      shouldShowRecipient,
      swapActionState.disabled,
      swapActionState.isLoading,
      swapActionState.label,
      themeVariant,
      costSavingsComponent,
    ],
  );

  const actionComponentCoverFooter = useMemo(
    () => (
      <>
        {actionComponent}
        {!platformEnv.isNativeIOS ? (
          <Page.Footer>
            <PercentageStageOnKeyboard
              onSelectPercentageStage={onSelectPercentageStage}
            />
          </Page.Footer>
        ) : null}
      </>
    ),
    [actionComponent, onSelectPercentageStage],
  );

  return (
    <>
      {isModalPage && !md ? (
        <PageFooter
          onSelectPercentageStage={onSelectPercentageStage}
          actionComponent={actionComponent}
          isModalPage={isModalPage}
          md={md}
        />
      ) : (
        actionComponentCoverFooter
      )}
    </>
  );
};

export default memo(SwapActionsState);
