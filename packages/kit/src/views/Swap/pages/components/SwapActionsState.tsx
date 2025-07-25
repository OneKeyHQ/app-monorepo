import { memo, useCallback, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';
import { Keyboard } from 'react-native';

import {
  Button,
  Icon,
  LottieView,
  Page,
  SizableText,
  Stack,
  XStack,
  useIsKeyboardShown,
  useIsModalPage,
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
  useInAppNotificationAtom,
  useSettingsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';
import {
  ESwapDirectionType,
  ESwapQuoteKind,
  SwapPercentageInputStageForNative,
} from '@onekeyhq/shared/types/swap/types';

import SwapPercentageStageBadge from '../../components/SwapPercentageStageBadge';
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

interface ISwapActionsStateProps {
  onPreSwap: () => void;
  onOpenRecipientAddress: () => void;
  onSelectPercentageStage?: (stage: number) => void;
}

function PercentageStageOnKeyboard({
  onSelectPercentageStage,
}: {
  onSelectPercentageStage?: (stage: number) => void;
}) {
  const isShow = useIsKeyboardShown();
  const [{ swapPercentageInputStageShowForNative }] =
    useInAppNotificationAtom();
  return isShow && swapPercentageInputStageShowForNative ? (
    <XStack
      alignItems="center"
      gap="$1"
      justifyContent="space-around"
      bg="$bgSubdued"
      h="$10"
    >
      <>
        {SwapPercentageInputStageForNative.map((stage) => (
          <SwapPercentageStageBadge
            badgeSize="lg"
            key={`swap-percentage-input-stage-${stage}`}
            stage={stage}
            borderRadius={0}
            onSelectStage={onSelectPercentageStage}
            flex={1}
            justifyContent="center"
            alignItems="center"
            h="$10"
          />
        ))}
        <Button
          icon="CheckLargeOutline"
          flex={1}
          h="$10"
          size="small"
          justifyContent="center"
          borderRadius={0}
          alignItems="center"
          variant="tertiary"
          onPress={() => {
            Keyboard.dismiss();
          }}
        />
      </>
    </XStack>
  ) : null;
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
      <PercentageStageOnKeyboard
        onSelectPercentageStage={onSelectPercentageStage}
      />
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
  const [swapProviderSupportReceiveAddress] =
    useSwapProviderSupportReceiveAddressAtom();
  const [{ swapEnableRecipientAddress }] = useSettingsAtom();
  const quoteLoading = useSwapQuoteLoading();
  const swapRecipientAddressInfo = useSwapRecipientAddressInfo(
    swapEnableRecipientAddress,
  );
  if (swapSlippageRef.current !== slippageItem) {
    swapSlippageRef.current = slippageItem;
  }
  const themeVariant = useThemeVariant();
  const quoting = useSwapQuoteEventFetching();

  const isModalPage = useIsModalPage();
  const { md } = useMedia();

  const onActionHandlerBefore = useCallback(() => {
    if (swapActionState.noConnectWallet) {
      navigation.pushModal(EModalRoutes.OnboardingModal, {
        screen: EOnboardingPages.GetStarted,
      });
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
        <Button
          onPress={onActionHandlerBefore}
          size={isModalPage && !md ? 'medium' : 'large'}
          variant="primary"
          disabled={swapActionState.disabled || swapActionState.isLoading}
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
    ],
  );

  const actionComponentCoverFooter = useMemo(
    () => (
      <>
        {actionComponent}
        <Page.Footer>
          <PercentageStageOnKeyboard
            onSelectPercentageStage={onSelectPercentageStage}
          />
        </Page.Footer>
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
