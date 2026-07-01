import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import BigNumber from 'bignumber.js';
import { debounce } from 'lodash';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import type { ColorTokens, IPageNavigationProp } from '@onekeyhq/components';
import {
  Badge,
  Button,
  Dialog,
  Divider,
  EPageType,
  GlassButtonCapsule,
  HeightTransition,
  Icon,
  ScrollView,
  SegmentControl,
  SizableText,
  Stack,
  Switch,
  XStack,
  YStack,
  useInModalDialog,
  useInTabDialog,
  useKeyboardHeight,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import {
  HeaderButtonGroup,
  HeaderIconButton,
} from '@onekeyhq/components/src/layouts/Navigation/Header';
import { SlippageInput } from '@onekeyhq/kit/src/components/SlippageSettingDialog';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useSwapActions,
  useSwapProSelectTokenAtom,
  useSwapProTradeTypeAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import {
  EJotaiContextStoreNames,
  filterSwapHistoryPendingList,
  useInAppNotificationAtom,
  useSettingsAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { dismissKeyboard } from '@onekeyhq/shared/src/keyboard';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes/swap';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  swapSlippageCustomDefaultList,
  swapSlippageItems,
  swapSlippageMaxValue,
  swapSlippageWillAheadMinValue,
  swapSlippageWillFailMinValue,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapSlippageSegmentItem } from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapLimitOrderStatus,
  ESwapProTradeType,
  ESwapSlippageCustomStatus,
  ESwapSlippageSegmentKey,
  ESwapTabSwitchType,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapSlippagePercentageModeInfo } from '../../hooks/useSwapState';
import { SwapTestIDs } from '../../testIDs';
import { buildSwapRecipientAddressSettingsUpdate } from '../../utils/incognitoSettings';
import { filterSwapMarketHistoryItems } from '../../utils/swapMarketHistory';
import { SwapKLineContentWithProvider } from '../modal/SwapKLineContent';
import { SwapProviderMirror } from '../SwapProviderMirror';

import ProviderManageContainer from './ProviderManageContainer';

import type { IMarketPresetSettingsState } from '../../../Market/MarketDetailV2/components/SwapPanel/hooks/useMarketPresetSettings';

const SwapSettingsCommonItem = ({
  value,
  onChange,
  title,
  content,
  badgeContent,
}: {
  title: string;
  content: string;
  badgeContent?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) => (
  <XStack justifyContent="space-between" alignItems="center">
    <YStack flex={1} gap="$0.5">
      <XStack alignItems="center" gap="$1.5">
        <SizableText size="$bodyLgMedium">{title}</SizableText>
        {badgeContent ? (
          <Badge badgeSize="sm" badgeType="success">
            {badgeContent}
          </Badge>
        ) : null}
      </XStack>
      <SizableText size="$bodyMd" color="$textSubdued" width="95%">
        {content}
      </SizableText>
    </YStack>
    <Switch
      value={value}
      onChange={onChange}
      testID="swap-swap-settings-common-item-switch"
    />
  </XStack>
);

const SwapProviderSettingItem = ({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) => (
  <XStack
    justifyContent="space-between"
    alignItems="center"
    onPress={onPress}
    cursor="pointer"
  >
    <SizableText size="$bodyLgMedium">{title}</SizableText>
    <Icon name="ChevronRightSmallOutline" size="$6" color="$iconSubdued" />
  </XStack>
);

const SwapSettingsSlippageItem = ({
  title,
  rightTrigger,
}: {
  title: string;
  rightTrigger: React.ReactNode;
}) => (
  <XStack justifyContent="space-between" alignItems="center">
    <XStack>
      <SizableText userSelect="none" mr="$1" size="$bodyLgMedium" color="$text">
        {title}
      </SizableText>
    </XStack>
    <XStack gap="$2">{rightTrigger}</XStack>
  </XStack>
);

const SWAP_SETTINGS_DIALOG_TOP_SAFE_GAP = 16;
const SWAP_SETTINGS_DIALOG_CHROME_HEIGHT = 220;
const SWAP_SETTINGS_DIALOG_MIN_CONTENT_HEIGHT = 120;

const SwapSlippageCustomContent = ({
  swapSlippage,
}: {
  swapSlippage: ISwapSlippageSegmentItem;
}) => {
  const intl = useIntl();
  const [, setSettings] = useSettingsAtom();
  const [customValueState, setCustomValueState] = useState<{
    status: ESwapSlippageCustomStatus;
    message: string;
  }>({ status: ESwapSlippageCustomStatus.NORMAL, message: '' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleSlippageChange = useCallback(
    debounce((value: string) => {
      const valueBN = new BigNumber(value);
      if (
        valueBN.isNaN() ||
        valueBN.isNegative() ||
        valueBN.gt(swapSlippageMaxValue)
      ) {
        setCustomValueState({
          status: ESwapSlippageCustomStatus.ERROR,
          message: intl.formatMessage({
            id: ETranslations.slippage_tolerance_error_message,
          }),
        });
        return;
      }
      setSettings((s) => ({
        ...s,
        swapSlippagePercentageMode: ESwapSlippageSegmentKey.CUSTOM,
        swapSlippagePercentageCustomValue: valueBN.toNumber(),
      }));
      if (valueBN.lte(swapSlippageWillFailMinValue)) {
        setCustomValueState({
          status: ESwapSlippageCustomStatus.WRONG,
          message: intl.formatMessage(
            {
              id: ETranslations.slippage_tolerance_warning_message_2,
            },
            { number: swapSlippageWillFailMinValue },
          ),
        });
        return;
      }
      if (valueBN.gte(swapSlippageWillAheadMinValue)) {
        setCustomValueState({
          status: ESwapSlippageCustomStatus.WRONG,
          message: intl.formatMessage(
            {
              id: ETranslations.slippage_tolerance_warning_message_1,
            },
            { number: swapSlippageWillAheadMinValue },
          ),
        });
        return;
      }
      setCustomValueState({
        status: ESwapSlippageCustomStatus.NORMAL,
        message: '',
      });
    }, 350),
    [],
  );
  return (
    <YStack gap="$4">
      <XStack gap="$2.5">
        <SlippageInput
          swapSlippage={swapSlippage}
          onChangeText={handleSlippageChange}
          testID={SwapTestIDs.slippageCustomInput}
        />
        <XStack>
          {swapSlippageCustomDefaultList.map((item, index) => (
            <>
              <Button
                testID="swap-btn"
                key={item}
                variant="secondary"
                size="medium"
                borderTopRightRadius={index !== 2 ? 0 : '$2'}
                borderBottomRightRadius={index !== 2 ? 0 : '$2'}
                borderTopLeftRadius={index !== 0 ? 0 : '$2'}
                borderBottomLeftRadius={index !== 0 ? 0 : '$2'}
                onPress={() => {
                  setCustomValueState({
                    status: ESwapSlippageCustomStatus.NORMAL,
                    message: '',
                  });
                  setSettings((s) => ({
                    ...s,
                    swapSlippagePercentageCustomValue: item,
                    swapSlippagePercentageMode: ESwapSlippageSegmentKey.CUSTOM,
                  }));
                }}
              >{`${item}${
                index === swapSlippageCustomDefaultList.length - 1 ? '  ' : ''
              }%`}</Button>
              {index !== swapSlippageCustomDefaultList.length - 1 ? (
                <Divider vertical />
              ) : null}
            </>
          ))}
        </XStack>
      </XStack>
      {swapSlippage.key !== ESwapSlippageSegmentKey.AUTO &&
      customValueState.status !== ESwapSlippageCustomStatus.NORMAL ? (
        <SizableText
          size="$bodySmMedium"
          color={
            customValueState.status === ESwapSlippageCustomStatus.ERROR
              ? '$textCritical'
              : '$textCaution'
          }
        >
          {customValueState.message}
        </SizableText>
      ) : null}
    </YStack>
  );
};

const SwapSettingsDialogContent = ({
  marketPresetSettings,
}: {
  marketPresetSettings?: IMarketPresetSettingsState;
}) => {
  const intl = useIntl();
  const { slippageItem } = useSwapSlippagePercentageModeInfo();
  const [{ swapEnableRecipientAddress }, setNoPersistSettings] =
    useSettingsAtom();
  const [{ swapBatchApproveAndSwap }, setPersistSettings] =
    useSettingsPersistAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const { cleanQuoteInterval, closeQuoteEvent, resetQuoteAction } =
    useSwapActions().current;
  const keyboardHeight = useKeyboardHeight();
  const { top: safeAreaTop } = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const focusSwapPro = useMemo(() => {
    return platformEnv.isNative && swapTypeSwitch === ESwapTabSwitchType.LIMIT;
  }, [swapTypeSwitch]);
  const showSwapProSlippageSetting =
    focusSwapPro &&
    (!marketPresetSettings ||
      (!marketPresetSettings.enabled && !marketPresetSettings.isLoading));
  const showSwapSettingsSlippage =
    (swapTypeSwitch !== ESwapTabSwitchType.LIMIT &&
      swapTypeSwitch !== ESwapTabSwitchType.STOCK) ||
    showSwapProSlippageSetting;
  const showSmartModeSetting =
    (swapTypeSwitch !== ESwapTabSwitchType.LIMIT &&
      swapTypeSwitch !== ESwapTabSwitchType.STOCK) ||
    focusSwapPro;
  const dialogContentMaxHeight = useMemo(() => {
    if (!platformEnv.isNative || keyboardHeight <= 0) {
      return undefined;
    }

    const availableHeight =
      windowHeight -
      keyboardHeight -
      safeAreaTop -
      SWAP_SETTINGS_DIALOG_TOP_SAFE_GAP -
      SWAP_SETTINGS_DIALOG_CHROME_HEIGHT;

    return Math.max(availableHeight, SWAP_SETTINGS_DIALOG_MIN_CONTENT_HEIGHT);
  }, [keyboardHeight, safeAreaTop, windowHeight]);
  const rightTrigger = useMemo(
    () => (
      <SegmentControl
        value={slippageItem.key}
        options={swapSlippageItems.map((item) => {
          const isActive = slippageItem.key === item.key;
          return {
            label: (
              <XStack>
                {item.key === ESwapSlippageSegmentKey.AUTO ? (
                  <Icon
                    name="Ai3StarOutline"
                    size="$4.5"
                    color={isActive ? '$iconInverse' : '$iconSuccess'}
                    mr="$0.5"
                  />
                ) : null}
                <SizableText
                  size="$bodyMdMedium"
                  color={isActive ? '$textInverse' : '$text'}
                >
                  {intl.formatMessage({
                    id:
                      item.key === ESwapSlippageSegmentKey.AUTO
                        ? ETranslations.slippage_tolerance_switch_auto
                        : ETranslations.slippage_tolerance_switch_custom,
                  })}
                </SizableText>
              </XStack>
            ),
            value: item.key,
          };
        })}
        onChange={(value) => {
          const keyValue = value as ESwapSlippageSegmentKey;
          setNoPersistSettings((s) => ({
            ...s,
            swapSlippagePercentageMode: keyValue,
          }));
        }}
      />
    ),
    [intl, setNoPersistSettings, slippageItem.key],
  );
  const dialogRef = useRef<ReturnType<typeof Dialog.show> | null>(null);
  const handleProviderManagerSaved = useCallback(() => {
    cleanQuoteInterval();
    closeQuoteEvent();
    void resetQuoteAction();
    void dialogRef.current?.close();
  }, [cleanQuoteInterval, closeQuoteEvent, resetQuoteAction]);
  return (
    <ScrollView
      mx="$-5"
      px="$5"
      pb="$5"
      maxHeight={dialogContentMaxHeight}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <YStack gap="$5">
        {showSwapSettingsSlippage ? (
          <>
            <HeightTransition>
              <YStack gap="$5">
                <SwapSettingsSlippageItem
                  title={intl.formatMessage({
                    id: ETranslations.swap_page_provider_slippage_tolerance,
                  })}
                  rightTrigger={rightTrigger}
                />
                {slippageItem.key === ESwapSlippageSegmentKey.CUSTOM ? (
                  <SwapSlippageCustomContent swapSlippage={slippageItem} />
                ) : null}
              </YStack>
            </HeightTransition>
            <Divider />
          </>
        ) : null}
        {showSmartModeSetting ? (
          <SwapSettingsCommonItem
            title={intl.formatMessage({
              id: ETranslations.swap_page_settings_simple_mode,
            })}
            content={intl.formatMessage({
              id: ETranslations.swap_page_settings_simple_mode_content,
            })}
            badgeContent="Beta"
            value={swapBatchApproveAndSwap}
            onChange={(v) => {
              setPersistSettings((s) => ({
                ...s,
                swapBatchApproveAndSwap: v,
              }));
            }}
          />
        ) : null}
        {focusSwapPro ? null : (
          <SwapSettingsCommonItem
            title={intl.formatMessage({
              id: ETranslations.swap_page_settings_recipient_title,
            })}
            content={intl.formatMessage({
              id: ETranslations.swap_page_settings_recipient_content,
            })}
            value={swapEnableRecipientAddress}
            onChange={(v) => {
              setNoPersistSettings((s) =>
                buildSwapRecipientAddressSettingsUpdate(s, v),
              );
            }}
          />
        )}
        {swapTypeSwitch !== ESwapTabSwitchType.LIMIT &&
        swapTypeSwitch !== ESwapTabSwitchType.STOCK ? (
          <>
            <SwapProviderSettingItem
              title={intl.formatMessage({
                id: ETranslations.swap_settings_manage_swap,
              })}
              onPress={() => {
                dialogRef.current = Dialog.show({
                  title: intl.formatMessage({
                    id: ETranslations.swap_settings_manage_swap,
                  }),
                  disableDrag: true,
                  renderContent: (
                    <ProviderManageContainer
                      mode="singleSwap"
                      onSaved={handleProviderManagerSaved}
                    />
                  ),
                  showConfirmButton: false,
                  showCancelButton: false,
                });
              }}
            />
            <SwapProviderSettingItem
              title={intl.formatMessage({
                id: ETranslations.swap_settings_manage_bridge,
              })}
              onPress={() => {
                dialogRef.current = Dialog.show({
                  title: intl.formatMessage({
                    id: ETranslations.swap_settings_manage_bridge,
                  }),
                  disableDrag: true,
                  renderContent: (
                    <ProviderManageContainer
                      mode="crossChain"
                      onSaved={handleProviderManagerSaved}
                    />
                  ),
                  showConfirmButton: false,
                  showCancelButton: false,
                });
              }}
            />
          </>
        ) : null}
      </YStack>
    </ScrollView>
  );
};

const StockKLineHeaderButton = ({
  iconSize,
  iconColor,
  buttonSize,
}: {
  iconSize: number | `$${string}`;
  iconColor?: ColorTokens;
  buttonSize: 'small' | 'medium';
}) => {
  const navigation = useAppNavigation();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const stockToken = useMemo(() => {
    if (fromToken?.isStock) {
      return fromToken;
    }
    if (toToken?.isStock) {
      return toToken;
    }
    return undefined;
  }, [fromToken, toToken]);
  const isNative = stockToken?.isNative;
  const networkId = stockToken?.networkId ?? '';
  const tokenAddress = stockToken?.contractAddress ?? '';
  const network = useMemo(
    () =>
      networkUtils.getNetworkShortCode({
        networkId,
      }) || networkId,
    [networkId],
  );
  const disabled =
    !stockToken?.symbol || !networkId || (!tokenAddress && !isNative);

  const onOpenStockMarketDetail = useCallback(() => {
    if (disabled) {
      return;
    }

    dismissKeyboard();
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapProMarketDetail,
      params: {
        tokenAddress,
        network,
        isNative,
        from: EEnterWay.SwapPro,
        disableTrade: true,
        showFavoriteButton: false,
      },
    });
  }, [disabled, isNative, navigation, network, tokenAddress]);

  return (
    <HeaderIconButton
      testID={SwapTestIDs.kLineButton}
      icon="TradingViewCandlesOutline"
      onPress={onOpenStockMarketDetail}
      disabled={disabled}
      iconProps={{ size: iconSize, color: iconColor ?? '$icon' }}
      size={buttonSize}
    />
  );
};

// Mobile Swap Pro: the candlestick button lives in the top capsule (consistent
// with the Swap & Bridge / Stocks tabs). It opens the Pro market detail for the
// currently selected Pro token — same destination as the old in-body button.
const SwapProKLineHeaderButton = ({
  iconSize,
  iconColor,
  buttonSize,
}: {
  iconSize: number | `$${string}`;
  iconColor?: ColorTokens;
  buttonSize: 'small' | 'medium';
}) => {
  const navigation = useAppNavigation();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const disabled =
    !swapProSelectToken?.networkId ||
    (!swapProSelectToken?.contractAddress && !swapProSelectToken?.isNative);

  const onOpenProMarketDetail = useCallback(() => {
    if (disabled) {
      return;
    }
    dismissKeyboard();
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapProMarketDetail,
      params: {
        tokenAddress: swapProSelectToken?.contractAddress ?? '',
        network: swapProSelectToken?.networkId ?? '',
        isNative: swapProSelectToken?.isNative,
        from: EEnterWay.SwapPro,
        disableTrade: true,
        showFavoriteButton: false,
      },
    });
  }, [
    disabled,
    navigation,
    swapProSelectToken?.contractAddress,
    swapProSelectToken?.networkId,
    swapProSelectToken?.isNative,
  ]);

  return (
    <HeaderIconButton
      testID={SwapTestIDs.kLineButton}
      icon="TradingViewCandlesOutline"
      onPress={onOpenProMarketDetail}
      disabled={disabled}
      iconProps={{ size: iconSize, color: iconColor ?? '$icon' }}
      size={buttonSize}
    />
  );
};

type ISwapSettingsHeaderButtonProps = {
  pageType?: EPageType;
  iconSize?: number | `$${string}`;
  iconColor?: ColorTokens;
  compact?: boolean;
  marketPresetSettings?: IMarketPresetSettingsState;
};

export function SwapSettingsHeaderButton({
  pageType,
  iconSize,
  iconColor,
  compact,
  marketPresetSettings,
}: ISwapSettingsHeaderButtonProps) {
  const intl = useIntl();
  const { slippageItem } = useSwapSlippagePercentageModeInfo();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const swapStoreName =
    pageType === EPageType.modal
      ? EJotaiContextStoreNames.swapModal
      : EJotaiContextStoreNames.swap;
  const focusSwapPro =
    platformEnv.isNative && swapTypeSwitch === ESwapTabSwitchType.LIMIT;
  const showSwapProSlippageSetting =
    focusSwapPro &&
    (!marketPresetSettings ||
      (!marketPresetSettings.enabled && !marketPresetSettings.isLoading));
  const showHeaderSlippageValue =
    !compact &&
    ((swapTypeSwitch !== ESwapTabSwitchType.LIMIT &&
      swapTypeSwitch !== ESwapTabSwitchType.STOCK) ||
      showSwapProSlippageSetting);
  const slippageTitle = useMemo(() => {
    if (!showHeaderSlippageValue) {
      return null;
    }
    if (slippageItem.key === ESwapSlippageSegmentKey.CUSTOM) {
      return (
        <SizableText
          color={
            slippageItem.value > swapSlippageWillAheadMinValue
              ? '$textCaution'
              : '$text'
          }
          size="$bodyMdMedium"
        >{`${slippageItem.value}%`}</SizableText>
      );
    }
    return null;
  }, [showHeaderSlippageValue, slippageItem.key, slippageItem.value]);
  const resolvedIconSize = iconSize ?? (compact ? 24 : 20);
  const resolvedButtonSize = compact ? 'small' : 'medium';
  const onOpenSwapSettings = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.swap_page_settings,
      }),
      renderContent: (
        <SwapProviderMirror storeName={swapStoreName}>
          <SwapSettingsDialogContent
            marketPresetSettings={marketPresetSettings}
          />
        </SwapProviderMirror>
      ),
      showConfirmButton: false,
      showCancelButton: true,
      onCancelText: intl.formatMessage({
        id: ETranslations.global_close,
      }),
      showFooter: true,
    });
  }, [intl, marketPresetSettings, swapStoreName]);

  if (slippageTitle) {
    return (
      <XStack
        testID={SwapTestIDs.settingsButton}
        onPress={onOpenSwapSettings}
        borderRadius="$3"
        bg="$bgSubdued"
        cursor="pointer"
        px={compact ? '$1.5' : '$2'}
        py="$1"
        gap={compact ? '$0.5' : '$1'}
        alignItems="center"
        justifyContent="center"
        hoverStyle={{
          bg: '$bgHover',
        }}
        pressStyle={{
          bg: '$bgActive',
        }}
      >
        {slippageTitle}
        <Icon
          name="SliderHorOutline"
          size={resolvedIconSize}
          color={iconColor ?? '$icon'}
        />
      </XStack>
    );
  }

  return (
    <HeaderIconButton
      testID={SwapTestIDs.settingsButton}
      icon="SliderHorOutline"
      onPress={onOpenSwapSettings}
      iconProps={{ size: resolvedIconSize, color: iconColor }}
      size={resolvedButtonSize}
    />
  );
}

const SwapHeaderRightActionContainer = ({
  pageType,
  iconSize,
  iconColor,
  compact,
  marketPresetSettings,
}: {
  pageType?: EPageType;
  iconSize?: number | `$${string}`;
  iconColor?: ColorTokens;
  compact?: boolean;
  marketPresetSettings?: IMarketPresetSettingsState;
}) => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const [{ swapHistoryPendingList, swapLimitOrders }] =
    useInAppNotificationAtom();
  const intl = useIntl();
  const { gtLg } = useMedia();
  const InTabDialog = useInTabDialog();
  const InModalDialog = useInModalDialog();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const swapStoreName =
    pageType === EPageType.modal
      ? EJotaiContextStoreNames.swapModal
      : EJotaiContextStoreNames.swap;
  const historyProtocolType = useMemo(() => {
    if (swapTypeSwitch === ESwapTabSwitchType.STOCK) {
      return EProtocolOfExchange.STOCK;
    }
    if (
      swapTypeSwitch !== ESwapTabSwitchType.LIMIT ||
      (platformEnv.isNative && swapProTradeType === ESwapProTradeType.MARKET)
    ) {
      return EProtocolOfExchange.SWAP;
    }
    return EProtocolOfExchange.LIMIT;
  }, [swapProTradeType, swapTypeSwitch]);
  const swapPendingStatusList = useMemo(
    () =>
      filterSwapMarketHistoryItems({
        items: filterSwapHistoryPendingList(swapHistoryPendingList),
        protocol: historyProtocolType,
      }).filter(
        (i) =>
          i.status === ESwapTxHistoryStatus.PENDING ||
          i.status === ESwapTxHistoryStatus.CANCELING,
      ),
    [historyProtocolType, swapHistoryPendingList],
  );
  const limitOpenStatusList = useMemo(
    () =>
      swapLimitOrders.filter(
        (i) =>
          i.status === ESwapLimitOrderStatus.OPEN ||
          i.status === ESwapLimitOrderStatus.PRESIGNATURE_PENDING,
      ),
    [swapLimitOrders],
  );
  const historyBadgeCount =
    swapPendingStatusList.length + limitOpenStatusList.length;
  const focusSwapPro =
    platformEnv.isNative && swapTypeSwitch === ESwapTabSwitchType.LIMIT;
  const resolvedIconSize = iconSize ?? (compact ? 24 : 20);
  const resolvedButtonSize = compact ? 'small' : 'medium';
  const isStockType = swapTypeSwitch === ESwapTabSwitchType.STOCK;
  const onOpenHistoryListModal = useCallback(() => {
    dismissKeyboard();
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapHistoryList,
      params: {
        type: historyProtocolType,
        storeName: swapStoreName,
      },
    });
  }, [historyProtocolType, navigation, swapStoreName]);

  const showKLineButton =
    swapTypeSwitch === ESwapTabSwitchType.SWAP ||
    swapTypeSwitch === ESwapTabSwitchType.STOCK ||
    swapTypeSwitch === ESwapTabSwitchType.LIMIT;
  const isKLineDisabled = !fromToken && !toToken;
  // On native, the K-line in-page dialog (InTabDialog / InModalDialog) does not
  // mount when triggered from the header capsule, so the Swap & Bridge button
  // appeared unresponsive. Use the full SwapKLine modal on native instead — the
  // same navigation.pushModal mechanism the Stocks / Pro buttons and desktop
  // already use successfully. Keep the dialog only for the small extension popup.
  const showKLineAsDialog = platformEnv.isExtension && !gtLg;
  const kLineDialogRef = useRef<ReturnType<typeof Dialog.show> | null>(null);
  const onOpenSwapKLineModal = useCallback(() => {
    if (isKLineDisabled) {
      return;
    }

    dismissKeyboard();
    if (showKLineAsDialog) {
      void kLineDialogRef.current?.close();
      let dialog: ReturnType<typeof Dialog.show> | null = null;
      const dialogController =
        pageType === EPageType.modal ? InModalDialog : InTabDialog;
      dialog = dialogController.show({
        testID: SwapTestIDs.kLineModal,
        title: intl.formatMessage({
          id: ETranslations.market_chart,
        }),
        disableDrag: true,
        estimatedContentHeight: 460,
        contentContainerProps: {
          px: '$0',
          pb: '$0',
        },
        showFooter: false,
        showCancelButton: false,
        showConfirmButton: false,
        onClose: () => {
          if (kLineDialogRef.current === dialog) {
            kLineDialogRef.current = null;
          }
        },
        renderContent: (
          <SwapKLineContentWithProvider
            storeName={swapStoreName}
            variant="dialog"
          />
        ),
      });
      kLineDialogRef.current = dialog;
      return;
    }

    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapKLine,
      params: {
        storeName: swapStoreName,
      },
    });
  }, [
    InModalDialog,
    InTabDialog,
    intl,
    isKLineDisabled,
    navigation,
    pageType,
    showKLineAsDialog,
    swapStoreName,
  ]);

  let kLineButton: ReactNode = null;
  if (showKLineButton) {
    if (isStockType) {
      kLineButton = (
        <StockKLineHeaderButton
          iconSize={resolvedIconSize}
          iconColor={iconColor}
          buttonSize={resolvedButtonSize}
        />
      );
    } else if (focusSwapPro) {
      kLineButton = (
        <SwapProKLineHeaderButton
          iconSize={resolvedIconSize}
          iconColor={iconColor}
          buttonSize={resolvedButtonSize}
        />
      );
    } else {
      kLineButton = (
        <HeaderIconButton
          testID={SwapTestIDs.kLineButton}
          icon="TradingViewCandlesOutline"
          onPress={onOpenSwapKLineModal}
          disabled={isKLineDisabled}
          iconProps={{ size: resolvedIconSize, color: iconColor ?? '$icon' }}
          size={resolvedButtonSize}
        />
      );
    }
  }

  return (
    // iOS 26: the three actions share one Liquid Glass capsule (like the Wallet
    // header's notification/menu capsule). Passthrough off iOS 26 / non-native.
    <GlassButtonCapsule>
      <HeaderButtonGroup gap={compact ? '$2' : '$4'} flexShrink={0}>
        {kLineButton}
        <SwapSettingsHeaderButton
          pageType={pageType}
          iconSize={iconSize}
          iconColor={iconColor}
          compact={compact}
          marketPresetSettings={marketPresetSettings}
        />

        {/* On mobile every tab has its own Order History list, so the global
            history button is hidden there; keep it on desktop / web / ext. */}
        {!platformEnv.isNative &&
          (historyBadgeCount > 0 ? (
            <Stack
              testID={SwapTestIDs.historyButton}
              m={compact ? '$0' : '$0.5'}
              w="$5"
              h="$5"
              userSelect="none"
              borderRadius="$full"
              borderColor="$icon"
              borderWidth={1.2}
              alignItems="center"
              justifyContent="center"
              hoverStyle={{
                bg: '$bgHover',
              }}
              pressStyle={{
                bg: '$bgActive',
              }}
              focusVisibleStyle={{
                outlineColor: '$focusRing',
                outlineWidth: 2,
                outlineStyle: 'solid',
                outlineOffset: 0,
              }}
              onPress={onOpenHistoryListModal}
            >
              <SizableText color="$text" size="$bodySm">
                {`${historyBadgeCount}`}
              </SizableText>
            </Stack>
          ) : (
            <HeaderIconButton
              testID={SwapTestIDs.historyButton}
              icon="ClockTimeHistoryOutline"
              onPress={onOpenHistoryListModal}
              iconProps={{
                size: resolvedIconSize,
                color: iconColor ?? '$icon',
              }}
              size={resolvedButtonSize}
            />
          ))}
      </HeaderButtonGroup>
    </GlassButtonCapsule>
  );
};

export default SwapHeaderRightActionContainer;
