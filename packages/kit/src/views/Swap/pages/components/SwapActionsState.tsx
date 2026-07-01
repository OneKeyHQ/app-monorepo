import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  DashText,
  ESwitchSize,
  Icon,
  LottieView,
  Page,
  Popover,
  SizableText,
  Stack,
  Switch,
  Tooltip,
  XStack,
  resetToRoute,
  useIsOverlayPage,
  useMedia,
} from '@onekeyhq/components';
import { FormatHyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EOnboardingPages,
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import { EModalAddressBookRoutes } from '@onekeyhq/shared/src/routes/addressBook';
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
  shouldBlockSwapActionForIncognitoRecipientInput,
  useSwapIncognitoRecipientInput,
} from '../../hooks/useSwapIncognitoRecipientInput';
import {
  useSwapActionState,
  useSwapQuoteProgressState,
  useSwapSlippagePercentageModeInfo,
} from '../../hooks/useSwapState';
import { SwapTestIDs } from '../../testIDs';
import { buildSwapIncognitoSettingsUpdate } from '../../utils/incognitoSettings';

import { SwapIncognitoRecipientInput } from './SwapIncognitoRecipientInput';
import { PercentageStageOnKeyboard } from './SwapInputContainer';

interface ISwapActionsStateProps {
  onPreSwap: () => void;
  onOpenRecipientAddress: () => void;
  onSelectPercentageStage?: (stage: number) => void;
}

// cspell:ignore ellipsize

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
      swapIncognitoMode,
      swapToAnotherAccountSwitchOn,
    },
    setSettings,
  ] = useSettingsAtom();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const { quoteLoading, quoteEventFetching, isWaitingActionableQuote } =
    useSwapQuoteProgressState();
  const swapRecipientAddressInfo = useSwapRecipientAddressInfo(
    swapEnableRecipientAddress,
  );
  if (swapSlippageRef.current !== slippageItem) {
    swapSlippageRef.current = slippageItem;
  }
  const themeVariant = useThemeVariant();
  const [desktopActionWidth, setDesktopActionWidth] = useState<number>();

  const isModalPage = useIsOverlayPage();
  const { gtMd, md } = useMedia();
  const isDesktopModalPage = isModalPage && !md;
  const incognitoHelpLink = useHelpLink({
    path: 'articles/14430164',
  });
  const incognitoTitle = intl.formatMessage({
    id: ETranslations.trade_privacy_mode,
  });
  const incognitoTooltipDescription = useMemo(
    () =>
      `${intl.formatMessage({
        id: ETranslations.trade_privacy_mode_tooltips,
      })} <url>${incognitoHelpLink}<underline>${intl.formatMessage({
        id: ETranslations.trade_incognito_read_more,
      })}</underline></url>`,
    [incognitoHelpLink, intl],
  );
  const incognitoTooltipContent = useMemo(
    () => (
      <FormatHyperlinkText
        autoExecuteParsedAction={false}
        onAction={openUrlExternal}
        size="$bodyMd"
        color="$textSubdued"
        urlTextProps={{
          color: '$textInfo',
        }}
        underlineTextProps={{
          color: '$textInfo',
        }}
      >
        {incognitoTooltipDescription}
      </FormatHyperlinkText>
    ),
    [incognitoTooltipDescription],
  );
  const incognitoPopoverContent = useMemo(
    () => (
      <Stack px="$5" pt="$1" pb="$5">
        {incognitoTooltipContent}
      </Stack>
    ),
    [incognitoTooltipContent],
  );

  const shouldShowRecipient = useMemo(
    () =>
      !!(
        (swapTypeSwitch === ESwapTabSwitchType.LIMIT ||
          swapTypeSwitch === ESwapTabSwitchType.STOCK ||
          !swapIncognitoMode) &&
        swapEnableRecipientAddress &&
        swapProviderSupportReceiveAddress &&
        fromToken &&
        toToken
      ),
    [
      swapIncognitoMode,
      swapEnableRecipientAddress,
      swapProviderSupportReceiveAddress,
      fromToken,
      swapTypeSwitch,
      toToken,
    ],
  );

  const shouldShowIncognitoRecipientInput = useMemo(
    () =>
      !!(
        swapIncognitoMode &&
        swapProviderSupportReceiveAddress &&
        fromToken &&
        toToken &&
        swapTypeSwitch !== ESwapTabSwitchType.LIMIT &&
        swapTypeSwitch !== ESwapTabSwitchType.STOCK
      ),
    [
      fromToken,
      swapIncognitoMode,
      swapProviderSupportReceiveAddress,
      swapTypeSwitch,
      toToken,
    ],
  );

  const clearRecipientAddressOnHide = useMemo(
    () => swapIncognitoMode && !shouldShowRecipient,
    [shouldShowRecipient, swapIncognitoMode],
  );

  const incognitoRecipientInput = useSwapIncognitoRecipientInput({
    visible: shouldShowIncognitoRecipientInput,
    clearRecipientAddressOnHide,
    networkId: toToken?.networkId ?? swapToAddressInfo.networkId,
    accountId:
      swapToAddressInfo.accountInfo?.account?.id ??
      swapToAddressInfo.activeAccount?.account?.id,
    accountInfo:
      swapToAddressInfo.accountInfo ?? swapToAddressInfo.activeAccount,
    address: swapToAnotherAccountAddress.address,
    swapToAnotherAccountSwitchOn,
  });
  const {
    errorTranslationId: incognitoRecipientErrorTranslationId,
    inputText: incognitoRecipientInputText,
    loading: incognitoRecipientLoading,
    onInputChange: handleIncognitoRecipientInputChange,
    queryResult: incognitoRecipientQueryResult,
  } = incognitoRecipientInput;

  const handleAddRecipientAddressToAddressBook = useCallback(() => {
    const recipientAddress = incognitoRecipientInputText.trim();
    const recipientNetworkId =
      toToken?.networkId ?? swapToAddressInfo.networkId;

    if (!recipientAddress || !recipientNetworkId) {
      return;
    }

    navigation.pushModal(EModalRoutes.AddressBookModal, {
      screen: EModalAddressBookRoutes.EditItemModal,
      params: {
        address: recipientAddress,
        networkId: recipientNetworkId,
        isAllowListed: true,
        onSaveSuccess: () => {
          handleIncognitoRecipientInputChange(incognitoRecipientInputText);
        },
      },
    });
  }, [
    handleIncognitoRecipientInputChange,
    incognitoRecipientInputText,
    navigation,
    swapToAddressInfo.networkId,
    toToken?.networkId,
  ]);

  const shouldBlockIncognitoRecipientAction =
    shouldBlockSwapActionForIncognitoRecipientInput({
      enabled: incognitoRecipientInput.enabled,
      inputText: incognitoRecipientInput.inputText,
      loading: incognitoRecipientInput.loading,
      queryResult: incognitoRecipientInput.queryResult,
    });

  const isActionDisabled =
    swapActionState.disabled ||
    swapActionState.isLoading ||
    shouldBlockIncognitoRecipientAction;

  const onActionHandlerBefore = useCallback(async () => {
    if (shouldBlockIncognitoRecipientAction) {
      return;
    }

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
    shouldBlockIncognitoRecipientAction,
    swapActionState.isRefreshQuote,
    swapActionState.noConnectWallet,
    swapIncognitoMode,
    swapFromAddressInfo?.accountInfo?.account?.id,
    swapFromAddressInfo?.address,
    swapToAddressInfo?.address,
  ]);

  const incognitoRecipientInputComponent = useMemo(
    () => (
      <SwapIncognitoRecipientInput
        visible={shouldShowIncognitoRecipientInput}
        errorTranslationId={incognitoRecipientErrorTranslationId}
        inputText={incognitoRecipientInputText}
        loading={incognitoRecipientLoading}
        onAddRecipientAddressToAddressBook={
          handleAddRecipientAddressToAddressBook
        }
        onOpenRecipientAddress={onOpenRecipientAddress}
        onInputChange={handleIncognitoRecipientInputChange}
        queryResult={incognitoRecipientQueryResult}
      />
    ),
    [
      handleIncognitoRecipientInputChange,
      handleAddRecipientAddressToAddressBook,
      incognitoRecipientErrorTranslationId,
      incognitoRecipientInputText,
      incognitoRecipientLoading,
      incognitoRecipientQueryResult,
      onOpenRecipientAddress,
      shouldShowIncognitoRecipientInput,
    ],
  );

  const showRecipientInMetaRow = useMemo(
    () =>
      !md &&
      swapTypeSwitch !== ESwapTabSwitchType.LIMIT &&
      swapTypeSwitch !== ESwapTabSwitchType.STOCK,
    [md, swapTypeSwitch],
  );

  const shouldShowRecipientInMetaRow = useMemo(
    () => showRecipientInMetaRow && shouldShowRecipient,
    [showRecipientInMetaRow, shouldShowRecipient],
  );

  const shouldShowRecipientInActionRow = useMemo(
    () => shouldShowRecipient && !showRecipientInMetaRow,
    [shouldShowRecipient, showRecipientInMetaRow],
  );

  const applyIncognitoModeChange = useCallback(
    (value: boolean) => {
      const nextSettings = buildSwapIncognitoSettingsUpdate(
        {
          swapEnableRecipientAddress,
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
        swapToAddressInfo?.address,
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
      swapFromAddressInfo?.accountInfo?.account?.id,
      swapFromAddressInfo?.address,
      swapIncognitoMode,
      swapToAnotherAccountSwitchOn,
      swapToAddressInfo.address,
    ],
  );

  const onIncognitoModeChange = useCallback(
    (value: boolean) => {
      applyIncognitoModeChange(value);
    },
    [applyIncognitoModeChange],
  );

  const incognitoComponent = useMemo(
    () =>
      swapTypeSwitch === ESwapTabSwitchType.LIMIT ||
      swapTypeSwitch === ESwapTabSwitchType.STOCK ? null : (
        <XStack alignItems="center" gap="$2">
          <XStack alignItems="center" gap="$1.5">
            <Icon
              name="AnonymousHiddenOutline"
              size="$5"
              color="$iconSubdued"
            />
            {!platformEnv.isNative && gtMd ? (
              <Tooltip
                placement="top"
                hovering
                renderTrigger={
                  <DashText
                    size="$bodyMd"
                    color="$textSubdued"
                    dashThickness={0.5}
                    cursor="help"
                  >
                    {incognitoTitle}
                  </DashText>
                }
                renderContent={incognitoTooltipContent}
              />
            ) : (
              <Popover
                title={incognitoTitle}
                renderTrigger={
                  <DashText
                    size="$bodyMd"
                    color="$textSubdued"
                    dashThickness={0.5}
                    cursor="help"
                  >
                    {incognitoTitle}
                  </DashText>
                }
                renderContent={incognitoPopoverContent}
              />
            )}
          </XStack>
          <Stack ml={platformEnv.isNative ? '$-2' : undefined}>
            <Switch
              testID={SwapTestIDs.incognitoModeSwitch}
              size={ESwitchSize.extraSmall}
              value={swapIncognitoMode}
              onChange={onIncognitoModeChange}
            />
          </Stack>
        </XStack>
      ),
    [
      gtMd,
      incognitoPopoverContent,
      incognitoTooltipContent,
      incognitoTitle,
      onIncognitoModeChange,
      swapIncognitoMode,
      swapTypeSwitch,
    ],
  );

  const recipientAccountLabel = useMemo(() => {
    if (!swapRecipientAddressInfo?.showAddress) {
      return '';
    }

    if (swapRecipientAddressInfo?.isExtAccount) {
      return intl.formatMessage({
        id: ETranslations.swap_page_recipient_external_account,
      });
    }

    const rawRecipientAccountLabel = [
      swapRecipientAddressInfo?.accountInfo?.walletName,
      swapRecipientAddressInfo?.accountInfo?.accountName,
    ]
      .filter((item): item is string => Boolean(item))
      .join('-');

    if (!rawRecipientAccountLabel) {
      return '';
    }

    return rawRecipientAccountLabel;
  }, [
    intl,
    swapRecipientAddressInfo?.accountInfo?.accountName,
    swapRecipientAddressInfo?.accountInfo?.walletName,
    swapRecipientAddressInfo?.isExtAccount,
    swapRecipientAddressInfo?.showAddress,
  ]);

  const recipientSendToLabel = intl.formatMessage({
    id: ETranslations.swap_page_recipient_send_to,
  });

  const recipientAddLabel = intl.formatMessage({
    id: ETranslations.swap_page_recipient_add,
  });

  const recipientAddressDisplayLabel =
    swapRecipientAddressInfo?.showAddress ?? recipientAddLabel;

  const recipientAccountDisplayLabel =
    swapRecipientAddressInfo?.showAddress && recipientAccountLabel
      ? `(${recipientAccountLabel})`
      : null;

  const recipientComponent = useMemo(() => {
    if (shouldShowRecipientInActionRow) {
      return (
        <XStack
          gap="$1.5"
          {...(isDesktopModalPage ? { flex: 1 } : { pb: '$4' })}
        >
          <Stack>
            <Icon name="AddedPeopleOutline" size="$5" color="$iconSubdued" />
          </Stack>
          <XStack flex={1} flexWrap="wrap" gap="$1.5" minWidth={0}>
            <SizableText flexShrink={0} size="$bodyMd" color="$textSubdued">
              {recipientSendToLabel}
            </SizableText>
            <SizableText
              flexShrink={0}
              size="$bodyMd"
              cursor="pointer"
              textDecorationLine="underline"
              onPress={onOpenRecipientAddress}
            >
              {recipientAddressDisplayLabel}
            </SizableText>
            {recipientAccountDisplayLabel ? (
              <SizableText
                flexShrink={1}
                minWidth={0}
                size="$bodyMd"
                color="$textSubdued"
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {recipientAccountDisplayLabel}
              </SizableText>
            ) : null}
          </XStack>
        </XStack>
      );
    }
    return null;
  }, [
    recipientAccountDisplayLabel,
    recipientAddressDisplayLabel,
    recipientSendToLabel,
    onOpenRecipientAddress,
    isDesktopModalPage,
    shouldShowRecipientInActionRow,
  ]);

  const recipientFooterComponent = useMemo(() => {
    if (!isDesktopModalPage || !shouldShowRecipient) {
      return null;
    }

    return (
      <XStack
        gap="$1.5"
        flex={1}
        flexShrink={1}
        minWidth={0}
        alignItems="center"
        overflow="hidden"
      >
        <Stack flexShrink={0}>
          <Icon name="AddedPeopleOutline" size="$5" color="$iconSubdued" />
        </Stack>
        <XStack
          flex={1}
          minWidth={0}
          gap="$1.5"
          alignItems="center"
          overflow="hidden"
        >
          <SizableText flexShrink={0} size="$bodyMd" color="$textSubdued">
            {recipientSendToLabel}
          </SizableText>
          <SizableText
            flexShrink={1}
            minWidth={0}
            size="$bodyMd"
            cursor="pointer"
            textDecorationLine="underline"
            onPress={onOpenRecipientAddress}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {recipientAddressDisplayLabel}
          </SizableText>
          {recipientAccountDisplayLabel ? (
            <SizableText
              flexShrink={1}
              minWidth={0}
              size="$bodyMd"
              color="$textSubdued"
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {recipientAccountDisplayLabel}
            </SizableText>
          ) : null}
        </XStack>
      </XStack>
    );
  }, [
    isDesktopModalPage,
    onOpenRecipientAddress,
    recipientAccountDisplayLabel,
    recipientAddressDisplayLabel,
    recipientSendToLabel,
    shouldShowRecipient,
  ]);

  const recipientMetaRowComponent = useMemo(() => {
    if (!shouldShowRecipientInMetaRow) {
      return null;
    }

    return (
      <XStack minWidth={0} maxWidth="100%">
        <XStack
          gap="$1.5"
          flexWrap="wrap"
          justifyContent="flex-start"
          maxWidth="100%"
        >
          <Stack>
            <Icon name="AddedPeopleOutline" size="$5" color="$iconSubdued" />
          </Stack>
          <XStack
            flexWrap="wrap"
            justifyContent="flex-start"
            gap="$1.5"
            minWidth={0}
          >
            <SizableText flexShrink={0} size="$bodyMd" color="$textSubdued">
              {recipientSendToLabel}
            </SizableText>
            <SizableText
              flexShrink={0}
              size="$bodyMd"
              cursor="pointer"
              textDecorationLine="underline"
              onPress={onOpenRecipientAddress}
            >
              {recipientAddressDisplayLabel}
            </SizableText>
            {recipientAccountDisplayLabel ? (
              <SizableText
                flexShrink={1}
                minWidth={0}
                size="$bodyMd"
                color="$textSubdued"
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {recipientAccountDisplayLabel}
              </SizableText>
            ) : null}
          </XStack>
        </XStack>
      </XStack>
    );
  }, [
    onOpenRecipientAddress,
    recipientAccountDisplayLabel,
    recipientAddressDisplayLabel,
    recipientSendToLabel,
    shouldShowRecipientInMetaRow,
  ]);

  const costSavingsComponent = useMemo(() => {
    const hasCostSavings =
      currentQuoteRes?.fee?.costSavings &&
      new BigNumber(currentQuoteRes?.fee?.costSavings || 0).gt(0);

    if (hasCostSavings) {
      const isLoadingQuote = quoteEventFetching || quoteLoading;
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
    quoteEventFetching,
    quoteLoading,
    intl,
  ]);

  useEffect(() => {
    if (!costSavingsComponent) {
      setDesktopActionWidth(undefined);
    }
  }, [costSavingsComponent]);

  const onDesktopActionTagLayout = useCallback(
    (event: { nativeEvent: { layout: { width: number } } }) => {
      const nextWidth = event?.nativeEvent?.layout?.width;

      if (typeof nextWidth !== 'number' || Number.isNaN(nextWidth)) {
        return;
      }

      setDesktopActionWidth((prevWidth) =>
        prevWidth === nextWidth ? prevWidth : nextWidth,
      );
    },
    [],
  );

  const desktopActionWidthProps = useMemo(
    () =>
      desktopActionWidth
        ? {
            width: desktopActionWidth,
            minWidth: desktopActionWidth,
          }
        : undefined,
    [desktopActionWidth],
  );

  const actionButtonChildren = useMemo(
    () =>
      isWaitingActionableQuote || swapActionState.isWaitingAutoSlippage ? (
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
        <SizableText
          flex={platformEnv.isNativeAndroid ? 1 : undefined}
          flexShrink={1}
          minWidth={0}
          maxWidth="100%"
          size="$bodyLgMedium"
          color="$textInverse"
          textAlign="center"
        >
          {swapActionState.label}
        </SizableText>
      ),
    [
      isWaitingActionableQuote,
      swapActionState.isWaitingAutoSlippage,
      swapActionState.label,
      themeVariant,
    ],
  );

  const actionRowComponent = useMemo(
    () => (
      <Stack
        flex={1}
        {...(isDesktopModalPage
          ? {
              flexDirection: 'row',
              justifyContent: shouldShowRecipientInActionRow
                ? 'space-between'
                : 'flex-end',
              alignItems: 'center',
            }
          : {})}
      >
        {recipientComponent}
        <Stack gap="$2">
          {/* In desktop modal: show savings above button; otherwise show below */}
          {isDesktopModalPage ? costSavingsComponent : null}
          <Button
            testID={SwapTestIDs.swapButton}
            onPress={onActionHandlerBefore}
            size={isDesktopModalPage ? 'medium' : 'large'}
            variant="primary"
            disabled={isActionDisabled}
            borderRadius="$full"
            childrenAsText={false}
          >
            {actionButtonChildren}
          </Button>
          {/* In regular pages and non-desktop modal: show savings below button */}
          {!isDesktopModalPage ? costSavingsComponent : null}
        </Stack>
      </Stack>
    ),
    [
      onActionHandlerBefore,
      actionButtonChildren,
      isActionDisabled,
      isDesktopModalPage,
      recipientComponent,
      shouldShowRecipientInActionRow,
      costSavingsComponent,
    ],
  );

  const actionComponent = useMemo(() => {
    let metaRow = incognitoComponent;

    if (showRecipientInMetaRow && incognitoComponent) {
      metaRow = isDesktopModalPage ? (
        <XStack gap="$6" alignItems="center" flexWrap="wrap" width="100%">
          {incognitoComponent}
          {recipientMetaRowComponent}
        </XStack>
      ) : (
        <XStack
          gap="$4"
          alignItems="center"
          flexWrap="wrap"
          justifyContent="space-between"
          width="100%"
        >
          {incognitoComponent}
          {recipientMetaRowComponent}
        </XStack>
      );
    }

    return (
      <Stack
        gap="$4"
        {...(showRecipientInMetaRow
          ? {
              flex: 1,
              width: '100%',
            }
          : {})}
      >
        {metaRow}
        {incognitoRecipientInputComponent}
        {actionRowComponent}
      </Stack>
    );
  }, [
    actionRowComponent,
    incognitoRecipientInputComponent,
    incognitoComponent,
    showRecipientInMetaRow,
    isDesktopModalPage,
    recipientMetaRowComponent,
  ]);

  const desktopModalRecipientSection = useMemo(() => {
    if (!incognitoComponent && !incognitoRecipientInputComponent) {
      return null;
    }

    return (
      <Stack gap="$4">
        {incognitoComponent}
        {incognitoRecipientInputComponent}
      </Stack>
    );
  }, [incognitoComponent, incognitoRecipientInputComponent]);

  const desktopFooterComponent = useMemo(
    () => (
      <Page.Footer>
        <Stack p="$5" bg="$bgApp" gap="$2">
          {costSavingsComponent ? (
            <XStack width="100%" justifyContent="flex-end">
              <Stack
                flexShrink={0}
                alignItems="stretch"
                {...desktopActionWidthProps}
              >
                <Stack alignItems="center" onLayout={onDesktopActionTagLayout}>
                  {costSavingsComponent}
                </Stack>
              </Stack>
            </XStack>
          ) : null}
          <XStack width="100%" alignItems="center" gap="$4">
            <XStack
              flex={1}
              minWidth={0}
              gap="$6"
              alignItems="center"
              overflow="hidden"
            >
              {recipientFooterComponent}
            </XStack>
            <Stack
              flexShrink={0}
              alignItems="stretch"
              gap="$2"
              {...desktopActionWidthProps}
            >
              <Button
                testID={SwapTestIDs.actionPrimaryButton}
                onPress={onActionHandlerBefore}
                size="medium"
                variant="primary"
                disabled={isActionDisabled}
                borderRadius="$full"
                {...(desktopActionWidth ? { width: '100%' } : {})}
              >
                {actionButtonChildren}
              </Button>
            </Stack>
          </XStack>
        </Stack>
        {!platformEnv.isNativeIOS ? (
          <PercentageStageOnKeyboard
            onSelectPercentageStage={onSelectPercentageStage}
          />
        ) : null}
      </Page.Footer>
    ),
    [
      actionButtonChildren,
      costSavingsComponent,
      desktopActionWidth,
      desktopActionWidthProps,
      isActionDisabled,
      onActionHandlerBefore,
      onDesktopActionTagLayout,
      onSelectPercentageStage,
      recipientFooterComponent,
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
      {isDesktopModalPage ? (
        <>
          {desktopModalRecipientSection}
          {desktopFooterComponent}
        </>
      ) : (
        actionComponentCoverFooter
      )}
    </>
  );
};

export default memo(SwapActionsState);
