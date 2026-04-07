import { memo, useCallback, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { ICheckedState } from '@onekeyhq/components';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  ESwitchSize,
  Icon,
  LottieView,
  Page,
  SizableText,
  Stack,
  Switch,
  XStack,
  YStack,
  resetToRoute,
  useIsOverlayPage,
  useMedia,
} from '@onekeyhq/components';
import { FormatHyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import {
  useSwapActions,
  useSwapManualSelectQuoteProvidersAtom,
  useSwapProviderSupportReceiveAddressAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapQuoteEventTotalCountAtom,
  useSwapQuoteListAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapToAnotherAccountAddressAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import {
  useSettingsAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { SWAP_INCOGNITO_HELP_URL } from '@onekeyhq/shared/src/config/appConfig';
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
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import {
  ESwapDirectionType,
  ESwapQuoteKind,
  ESwapTabSwitchType,
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
import { buildSwapIncognitoSettingsUpdate } from '../../utils/incognitoSettings';

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

function SwapIncognitoDialogContent({
  onConfirm,
}: {
  onConfirm: () => Promise<void>;
}) {
  const intl = useIntl();
  const [checked, setChecked] = useState<ICheckedState>(false);

  const description = useMemo(
    () =>
      `${intl.formatMessage({
        id: ETranslations.trade_incognito_description,
      })} <url>${SWAP_INCOGNITO_HELP_URL}<underline>${intl.formatMessage({
        id: ETranslations.trade_incognito_read_more,
      })}</underline></url>`,
    [intl],
  );

  return (
    <YStack gap="$4">
      <FormatHyperlinkText
        autoExecuteParsedAction={false}
        onAction={openUrlExternal}
        size="$bodyLg"
        color="$text"
        urlTextProps={{
          color: '$textInfo',
        }}
      >
        {description}
      </FormatHyperlinkText>
      <XStack alignItems="flex-start" gap="$2">
        <Checkbox
          labelContainerProps={{
            flex: 1,
          }}
          label={intl.formatMessage({
            id: ETranslations.trade_incognito_kyc_warning,
          })}
          value={checked}
          onChange={setChecked}
          labelProps={{
            variant: '$bodyMd',
            color: '$textSubdued',
          }}
        />
      </XStack>
      <Dialog.Footer
        showCancelButton={false}
        confirmButtonProps={{
          disabled: !checked,
        }}
        onConfirm={onConfirm}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_confirm,
        })}
      />
    </YStack>
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
  const [, setSwapManualSelectQuoteProvider] =
    useSwapManualSelectQuoteProvidersAtom();
  const [, setSwapQuoteEventTotalCount] = useSwapQuoteEventTotalCountAtom();
  const [, setSwapQuoteList] = useSwapQuoteListAtom();
  const [swapToAnotherAccountAddress] = useSwapToAnotherAccountAddressAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const swapToAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const { cleanQuoteInterval, closeQuoteEvent, quoteAction } =
    useSwapActions().current;
  const swapActionState = useSwapActionState();
  const { slippageItem } = useSwapSlippagePercentageModeInfo();
  const swapSlippageRef = useRef(slippageItem);
  const hasEverShownCostSavingsRef = useRef(false);
  const [swapProviderSupportReceiveAddress] =
    useSwapProviderSupportReceiveAddressAtom();
  const [
    {
      swapEnableRecipientAddress,
      swapEnableRecipientAddressBeforeIncognito,
      swapIncognitoMode,
      swapToAnotherAccountSwitchOn,
    },
    setSettings,
  ] = useSettingsAtom();
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
        swapIncognitoMode,
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
    swapIncognitoMode,
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

  const applyIncognitoModeChange = useCallback(
    (value: boolean) => {
      const nextSettings = buildSwapIncognitoSettingsUpdate(
        {
          swapEnableRecipientAddress,
          swapEnableRecipientAddressBeforeIncognito,
          swapIncognitoMode,
          swapToAnotherAccountSwitchOn,
        },
        value,
      );

      setSettings((settings) =>
        buildSwapIncognitoSettingsUpdate(settings, value),
      );

      cleanQuoteInterval();
      closeQuoteEvent();
      setSwapManualSelectQuoteProvider(undefined);
      setSwapQuoteEventTotalCount({ count: 0 });
      setSwapQuoteList([]);

      if (
        swapToAnotherAccountSwitchOn &&
        !nextSettings.swapToAnotherAccountSwitchOn
      ) {
        return;
      }

      void quoteAction(
        swapSlippageRef.current,
        swapFromAddressInfo?.address,
        swapFromAddressInfo?.accountInfo?.account?.id,
        undefined,
        undefined,
        currentQuoteRes?.kind ?? ESwapQuoteKind.SELL,
        true,
        nextSettings.swapToAnotherAccountSwitchOn
          ? (swapToAnotherAccountAddress.address ?? swapToAddressInfo?.address)
          : swapToAddressInfo?.address,
        value,
      );
    },
    [
      cleanQuoteInterval,
      closeQuoteEvent,
      currentQuoteRes?.kind,
      quoteAction,
      setSettings,
      setSwapManualSelectQuoteProvider,
      setSwapQuoteEventTotalCount,
      setSwapQuoteList,
      swapEnableRecipientAddress,
      swapEnableRecipientAddressBeforeIncognito,
      swapFromAddressInfo?.accountInfo?.account?.id,
      swapFromAddressInfo?.address,
      swapIncognitoMode,
      swapToAnotherAccountSwitchOn,
      swapToAnotherAccountAddress.address,
      swapToAddressInfo.address,
    ],
  );

  const onIncognitoModeChange = useCallback(
    (value: boolean) => {
      if (!value) {
        applyIncognitoModeChange(false);
        return;
      }

      void Dialog.show({
        icon: 'AnonymousHiddenOutline',
        title: intl.formatMessage({
          id: ETranslations.trade_incognito_title,
        }),
        showFooter: false,
        renderContent: (
          <SwapIncognitoDialogContent
            onConfirm={async () => {
              applyIncognitoModeChange(true);
            }}
          />
        ),
      });
    },
    [applyIncognitoModeChange, intl],
  );

  const incognitoComponent = useMemo(
    () =>
      swapTypeSwitch === ESwapTabSwitchType.LIMIT ? null : (
        <XStack alignItems="center" gap="$1">
          <XStack alignItems="center" gap="$1">
            <Icon
              name="AnonymousHiddenOutline"
              size="$5"
              color="$iconSubdued"
            />
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.trade_incognito_incognito_mode,
              })}
            </SizableText>
          </XStack>
          <Switch
            size={ESwitchSize.small}
            value={swapIncognitoMode}
            onChange={onIncognitoModeChange}
          />
        </XStack>
      ),
    [intl, onIncognitoModeChange, swapIncognitoMode, swapTypeSwitch],
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

  const actionRowComponent = useMemo(
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

  const actionComponent = useMemo(
    () => (
      <Stack gap="$4">
        {incognitoComponent}
        {actionRowComponent}
      </Stack>
    ),
    [actionRowComponent, incognitoComponent],
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
