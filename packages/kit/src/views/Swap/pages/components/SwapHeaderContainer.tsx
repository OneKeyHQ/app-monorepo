import { memo, useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import type {
  EPageType,
  IPageNavigationProp,
  IStackProps,
} from '@onekeyhq/components';
import {
  SegmentControl,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import {
  ScrollableFilterBar,
  useScrollableFilterBar,
} from '@onekeyhq/kit/src/components/ScrollableFilterBar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions';
import {
  useSwapActions,
  useSwapProSelectTokenAtom,
  useSwapSelectFromTokenAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSwapProJumpTokenAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ITabSwapParamList } from '@onekeyhq/shared/src/routes';
import {
  ESwapDirectionType,
  ESwapProAnalyticsEnterFrom,
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapAddressInfo } from '../../hooks/useSwapAccount';
import { useSwapProTokenCarryOptions } from '../../hooks/useSwapProTokenCarry';
import { SwapTestIDs } from '../../testIDs';
import {
  getSwapAnalyticsCategoryFromSwapType,
  getSwapAnalyticsEnterFrom,
} from '../../utils/swapStockAnalytics';
import { getVisibleSwapTabSwitchType } from '../../utils/swapTypeUtils';

import SwapHeaderRightActionContainer from './SwapHeaderRightActionContainer';

import type { IMarketPresetSettingsState } from '../../../Market/MarketDetailV2/components/SwapPanel/hooks/useMarketPresetSettings';

type ICustomTabItemProps = IStackProps & {
  itemId: ESwapTabSwitchType;
  isSelected?: boolean;
  compact?: boolean;
  onPress?: IStackProps['onPress'];
};

function getRouteTabParamFromSwapType(type: ESwapTabSwitchType) {
  const visibleType = getVisibleSwapTabSwitchType(type) ?? type;
  if (visibleType === ESwapTabSwitchType.STOCK) {
    return 'stock';
  }
  if (visibleType === ESwapTabSwitchType.LIMIT) {
    return 'limit';
  }
  return 'swap';
}

function CustomTabItem({
  itemId,
  children,
  isSelected,
  compact,
  onPress,
  ...rest
}: ICustomTabItemProps) {
  const { handleItemLayout } = useScrollableFilterBar();
  return (
    <Stack
      py="$1"
      px={compact ? '$2' : '$2.5'}
      borderRadius="$2"
      borderCurve="continuous"
      userSelect="none"
      hitSlop={{
        top: 4,
        bottom: 4,
      }}
      {...(isSelected
        ? {
            bg: '$bgStrong',
          }
        : {
            hoverStyle: {
              bg: '$bgHover',
            },
            pressStyle: {
              bg: '$bgActive',
            },
          })}
      {...rest}
      testID={SwapTestIDs.typeTab(itemId)}
      onPress={onPress}
      onLayout={(event) => {
        handleItemLayout(itemId, event);
      }}
    >
      <SizableText
        size="$headingMd"
        color="$textSubdued"
        {...(isSelected && {
          color: '$text',
        })}
      >
        {children}
      </SizableText>
    </Stack>
  );
}

interface ISwapHeaderContainerProps {
  pageType?: EPageType;
  defaultSwapType?: ESwapTabSwitchType;
  showSwapPro?: boolean;
  /** Hide right action buttons (settings/history) - used when they're shown elsewhere in desktop layout */
  hideRightActions?: boolean;
  marketPresetSettings?: IMarketPresetSettingsState;
  enterFrom?: ESwapSource;
}

const DESKTOP_TRADE_TAB_ITEM_WIDTH = 144;
const DESKTOP_TRADE_TAB_GROUP_WIDTH = DESKTOP_TRADE_TAB_ITEM_WIDTH * 3;

const SwapHeaderContainer = ({
  pageType,
  defaultSwapType,
  showSwapPro,
  hideRightActions,
  marketPresetSettings,
  enterFrom,
}: ISwapHeaderContainerProps) => {
  const intl = useIntl();
  const { gtLg } = useMedia();
  const navigation = useAppNavigation<IPageNavigationProp<ITabSwapParamList>>();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const [swapProEntryIntent] = useSwapProJumpTokenAtom();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const { swapTypeSwitchAction } = useSwapActions().current;
  const { networkId } = useSwapAddressInfo(ESwapDirectionType.FROM);
  const { updateSelectedAccountNetwork } = useAccountSelectorActions().current;
  const [fromToken] = useSwapSelectFromTokenAtom();
  const swapProTokenCarryOptions = useSwapProTokenCarryOptions({
    enabled: Boolean(platformEnv.isNative && showSwapPro),
  });
  const networkIdRef = useRef(networkId);
  if (networkIdRef.current !== networkId) {
    networkIdRef.current = networkId;
  }
  if (networkIdRef.current !== fromToken?.networkId) {
    networkIdRef.current = fromToken?.networkId;
  }
  const hasPendingSwapProEntry = Boolean(
    platformEnv.isNative && pageType !== 'modal' && swapProEntryIntent.token,
  );
  const isSwapProCategory = Boolean(platformEnv.isNative && showSwapPro);
  const isSwapProActive = Boolean(
    isSwapProCategory && swapTypeSwitch === ESwapTabSwitchType.LIMIT,
  );
  const swapProEntryFromRef = useRef<ESwapProAnalyticsEnterFrom | undefined>(
    hasPendingSwapProEntry
      ? ESwapProAnalyticsEnterFrom.MARKET_DETAIL
      : undefined,
  );
  const wasSwapProActiveRef = useRef<boolean | undefined>(undefined);
  if (hasPendingSwapProEntry) {
    swapProEntryFromRef.current = ESwapProAnalyticsEnterFrom.MARKET_DETAIL;
  }
  useEffect(() => {
    if (!isSwapProActive) {
      wasSwapProActiveRef.current = false;
      return;
    }
    if (wasSwapProActiveRef.current && !hasPendingSwapProEntry) {
      return;
    }
    const token = swapProEntryIntent.token ?? swapProSelectToken;
    if (!token) {
      return;
    }
    defaultLogger.swap.swapPro.enterSwapPro({
      enterFrom:
        swapProEntryFromRef.current ??
        (wasSwapProActiveRef.current === false
          ? ESwapProAnalyticsEnterFrom.TRADE_TAB
          : ESwapProAnalyticsEnterFrom.DEFAULT),
      tokenSymbol: token.symbol,
      network: token.networkId,
    });
    wasSwapProActiveRef.current = true;
    swapProEntryFromRef.current = undefined;
  }, [
    isSwapProActive,
    hasPendingSwapProEntry,
    swapProEntryIntent.token,
    swapProSelectToken,
  ]);
  const hadPendingSwapProEntryOnMountRef = useRef(hasPendingSwapProEntry);
  useEffect(() => {
    if (hasPendingSwapProEntry) {
      navigation.setParams({
        tab: getRouteTabParamFromSwapType(ESwapTabSwitchType.LIMIT),
      });
    }
  }, [hasPendingSwapProEntry, navigation]);
  useEffect(() => {
    if (
      hadPendingSwapProEntryOnMountRef.current ||
      !defaultSwapType ||
      (pageType === 'modal' && enterFrom === ESwapSource.WALLET_HOME_TOKEN_LIST)
    ) {
      return;
    }
    // Avoid switching the default toToken before it has been loaded,
    // resulting in the default network toToken across chains
    const timer = setTimeout(
      () => {
        void swapTypeSwitchAction(defaultSwapType, networkIdRef.current);
      },
      platformEnv.isExtension ? 100 : 10,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSelectedAccountNetworkAction = useCallback(
    async (targetNetworkId: string) => {
      await updateSelectedAccountNetwork({
        num: 0,
        networkId: targetNetworkId,
      });
    },
    [updateSelectedAccountNetwork],
  );

  const syncRouteTabParam = useCallback(
    (type: ESwapTabSwitchType) => {
      if (pageType === 'modal') {
        return;
      }
      const tab = getRouteTabParamFromSwapType(type);
      navigation.setParams({ tab });
    },
    [navigation, pageType],
  );

  const handleSwapTypeChange = useCallback(
    async (value: string | number) => {
      const newType =
        value === ESwapTabSwitchType.BRIDGE
          ? ESwapTabSwitchType.SWAP
          : (value as ESwapTabSwitchType);
      if (swapTypeSwitch === newType) return;

      defaultLogger.swap.tradeCategorySwitch.tradeCategorySwitch({
        fromCategory: getSwapAnalyticsCategoryFromSwapType(
          swapTypeSwitch,
          isSwapProCategory,
        ),
        toCategory: getSwapAnalyticsCategoryFromSwapType(
          newType,
          isSwapProCategory,
        ),
        enterFrom: getSwapAnalyticsEnterFrom(enterFrom),
      });

      if (swapTypeSwitch === ESwapTabSwitchType.STOCK) {
        syncRouteTabParam(newType);
        await swapTypeSwitchAction(newType, networkId, {
          carryTargetToken: true,
          ...swapProTokenCarryOptions,
        });
        return;
      }

      syncRouteTabParam(newType);

      if (
        newType === ESwapTabSwitchType.LIMIT ||
        newType === ESwapTabSwitchType.STOCK
      ) {
        void swapTypeSwitchAction(newType, networkId, {
          carryTargetToken: true,
          ...swapProTokenCarryOptions,
        });
      } else {
        const settledFromToken = await swapTypeSwitchAction(
          newType,
          fromToken?.networkId || networkId,
          {
            carryTargetToken: true,
            ...swapProTokenCarryOptions,
          },
        );
        // Leave the Pro owner before awaiting account synchronization so its
        // network effect cannot switch the account back while this is in flight.
        // Cross-network carry can replace From with the target network's
        // native token, so synchronize from the settled pair.
        const settledFromNetworkId = settledFromToken?.networkId;
        if (settledFromNetworkId && settledFromNetworkId !== networkId) {
          await updateSelectedAccountNetworkAction(settledFromNetworkId);
        }
      }
    },
    [
      swapTypeSwitch,
      swapTypeSwitchAction,
      syncRouteTabParam,
      networkId,
      fromToken?.networkId,
      updateSelectedAccountNetworkAction,
      enterFrom,
      isSwapProCategory,
      swapProTokenCarryOptions,
    ],
  );

  // Desktop layout (gtLg and not modal): use SegmentControl
  const showDesktopLayout =
    gtLg &&
    pageType !== 'modal' &&
    !platformEnv.isNative &&
    !platformEnv.isExtensionUiSidePanel;
  // Single source key shared with the history modal title/dropdown so the
  // tab label never drifts from them per locale; composing
  // `swap_page_swap & swap_page_bridge` also hardcodes the "&" connector,
  // which is wrong for locales like bn/hi. (OK-58055)
  const swapBridgeLabel = intl.formatMessage({
    id: ETranslations.swap_history_title,
  });
  const stockLabel = intl.formatMessage({
    id: ETranslations.perps_token_selector_stocks,
  });

  const segmentOptions = [
    {
      label: swapBridgeLabel,
      value: ESwapTabSwitchType.SWAP,
      testID: SwapTestIDs.typeTab(ESwapTabSwitchType.SWAP),
    },
    {
      label: stockLabel,
      value: ESwapTabSwitchType.STOCK,
      testID: SwapTestIDs.typeTab(ESwapTabSwitchType.STOCK),
    },
    {
      label: intl.formatMessage({
        id: showSwapPro
          ? ETranslations.dexmarket_pro
          : ETranslations.swap_page_limit,
      }),
      value: ESwapTabSwitchType.LIMIT,
      testID: SwapTestIDs.typeTab(ESwapTabSwitchType.LIMIT),
    },
  ];

  if (showDesktopLayout) {
    return (
      <XStack justifyContent="center" px="$5">
        <SegmentControl
          width={DESKTOP_TRADE_TAB_GROUP_WIDTH}
          fullWidth
          value={swapTypeSwitch}
          options={segmentOptions.map((opt) => ({
            ...opt,
            label: (
              <SizableText
                size="$headingSm"
                textAlign="center"
                numberOfLines={1}
                color={swapTypeSwitch === opt.value ? '$text' : '$textSubdued'}
              >
                {opt.label}
              </SizableText>
            ),
          }))}
          onChange={handleSwapTypeChange}
          slotBackgroundColor="$neutral3"
          activeBackgroundColor="$bg"
          borderRadius="$full"
          p="$1"
          h="auto"
          segmentControlItemStyleProps={{
            py: '$2',
            px: '$0',
            borderRadius: '$full',
            alignItems: 'center',
            justifyContent: 'center',
            '$platform-web': {
              boxShadow: 'none',
            },
          }}
        />
      </XStack>
    );
  }

  const isCompactLayout = !showDesktopLayout;
  const useDesktopModalHeaderActions =
    pageType === 'modal' &&
    gtLg &&
    !platformEnv.isNative &&
    !platformEnv.isExtensionUiSidePanel;
  const tabs = (
    <>
      <CustomTabItem
        itemId={ESwapTabSwitchType.SWAP}
        compact={isCompactLayout}
        isSelected={swapTypeSwitch === ESwapTabSwitchType.SWAP}
        onPress={() => {
          void handleSwapTypeChange(ESwapTabSwitchType.SWAP);
        }}
      >
        {swapBridgeLabel}
      </CustomTabItem>
      <CustomTabItem
        itemId={ESwapTabSwitchType.STOCK}
        compact={isCompactLayout}
        isSelected={swapTypeSwitch === ESwapTabSwitchType.STOCK}
        onPress={() => {
          void handleSwapTypeChange(ESwapTabSwitchType.STOCK);
        }}
      >
        {stockLabel}
      </CustomTabItem>
      <CustomTabItem
        itemId={ESwapTabSwitchType.LIMIT}
        compact={isCompactLayout}
        isSelected={swapTypeSwitch === ESwapTabSwitchType.LIMIT}
        onPress={() => {
          void handleSwapTypeChange(ESwapTabSwitchType.LIMIT);
        }}
      >
        {intl.formatMessage({
          id: showSwapPro
            ? ETranslations.dexmarket_pro
            : ETranslations.swap_page_limit,
        })}
      </CustomTabItem>
    </>
  );

  return (
    <XStack
      alignItems="center"
      gap="$2"
      px="$5"
      py="$1"
      // iOS: fixed 56pt height (== Wallet header Row 1) so this header centers
      // its content at the same top+28 line as Wallet (see SwapMainLand
      // contentTopPadding=$0). Android keeps its intrinsic height unchanged.
      // zIndex lifts the header (and its glass capsule's shadow) above the
      // sibling content below it (e.g. the Pro panel), which otherwise paints
      // over and clips the glass shadow.
      {...(platformEnv.isNativeIOS && { height: 56, zIndex: 1 })}
    >
      <Stack flex={1} minWidth={0}>
        <ScrollableFilterBar
          selectedItemId={swapTypeSwitch}
          itemGap="$1.5"
          itemPr="$5"
        >
          {tabs}
        </ScrollableFilterBar>
      </Stack>
      {!hideRightActions ? (
        <SwapHeaderRightActionContainer
          pageType={pageType}
          marketPresetSettings={marketPresetSettings}
          routeSwapType={defaultSwapType}
          compact={Boolean(isCompactLayout && !useDesktopModalHeaderActions)}
        />
      ) : null}
    </XStack>
  );
};

export default memo(SwapHeaderContainer);
