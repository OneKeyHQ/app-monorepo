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
import { ScrollableFilterBar } from '@onekeyhq/kit/src/components/ScrollableFilterBar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapInitialSelectedTokensSyncedAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectedTokensColdStartContextAtom,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ITabSwapParamList } from '@onekeyhq/shared/src/routes';
import {
  ESwapDirectionType,
  type ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapAddressInfo } from '../../hooks/useSwapAccount';
import { getVisibleSwapTabSwitchType } from '../../utils/swapTypeUtils';

import SwapHeaderRightActionContainer from './SwapHeaderRightActionContainer';

import type { IMarketPresetSettingsState } from '../../../Market/MarketDetailV2/components/SwapPanel/hooks/useMarketPresetSettings';

type ICustomTabItemProps = IStackProps & {
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
  children,
  isSelected,
  compact,
  onPress,
  ...rest
}: ICustomTabItemProps) {
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
      onPress={onPress}
      {...rest}
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
  const [, setFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [, setToTokenAmount] = useSwapToTokenAmountAtom();
  const [, setInitialSelectedTokensSynced] =
    useSwapInitialSelectedTokensSyncedAtom();
  const [, setSelectedTokensColdStartContext] =
    useSwapSelectedTokensColdStartContextAtom();
  const { resetSwapTokenData, swapTypeSwitchAction } = useSwapActions().current;
  const { networkId } = useSwapAddressInfo(ESwapDirectionType.FROM);
  const { updateSelectedAccountNetwork } = useAccountSelectorActions().current;
  const [fromToken] = useSwapSelectFromTokenAtom();
  const networkIdRef = useRef(networkId);
  if (networkIdRef.current !== networkId) {
    networkIdRef.current = networkId;
  }
  if (networkIdRef.current !== fromToken?.networkId) {
    networkIdRef.current = fromToken?.networkId;
  }
  useEffect(() => {
    if (defaultSwapType) {
      // Avoid switching the default toToken before it has been loaded,
      // resulting in the default network toToken across chains
      setTimeout(
        () => {
          void swapTypeSwitchAction(defaultSwapType, networkIdRef.current);
        },
        platformEnv.isExtension ? 100 : 10,
      );
    }
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

  const clearStockTokensBeforeLeaving = useCallback(async () => {
    if (swapTypeSwitch !== ESwapTabSwitchType.STOCK) {
      return;
    }
    await resetSwapTokenData(ESwapDirectionType.FROM);
    await resetSwapTokenData(ESwapDirectionType.TO);
    setFromTokenAmount({ value: '', isInput: false });
    setToTokenAmount({ value: '', isInput: false });
    setSelectedTokensColdStartContext(undefined);
    setInitialSelectedTokensSynced(false);
  }, [
    resetSwapTokenData,
    setFromTokenAmount,
    setInitialSelectedTokensSynced,
    setSelectedTokensColdStartContext,
    setToTokenAmount,
    swapTypeSwitch,
  ]);

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
        fromCategory: swapTypeSwitch,
        toCategory: newType,
        enterFrom,
      });

      if (swapTypeSwitch === ESwapTabSwitchType.STOCK) {
        await clearStockTokensBeforeLeaving();
        void swapTypeSwitchAction(newType, networkId);
        syncRouteTabParam(newType);
        return;
      }

      syncRouteTabParam(newType);

      if (
        newType === ESwapTabSwitchType.LIMIT ||
        newType === ESwapTabSwitchType.STOCK
      ) {
        void swapTypeSwitchAction(newType, networkId);
      } else {
        if (fromToken?.networkId && fromToken?.networkId !== networkId) {
          await updateSelectedAccountNetworkAction(fromToken?.networkId);
        }
        void swapTypeSwitchAction(newType, fromToken?.networkId || networkId);
      }
    },
    [
      swapTypeSwitch,
      swapTypeSwitchAction,
      clearStockTokensBeforeLeaving,
      syncRouteTabParam,
      networkId,
      fromToken?.networkId,
      updateSelectedAccountNetworkAction,
      enterFrom,
    ],
  );

  // Desktop layout (gtLg and not modal): use SegmentControl
  const showDesktopLayout =
    gtLg &&
    pageType !== 'modal' &&
    !platformEnv.isNative &&
    !platformEnv.isExtensionUiSidePanel;
  const swapBridgeLabel = `${intl.formatMessage({
    id: ETranslations.swap_page_swap,
  })} & ${intl.formatMessage({ id: ETranslations.swap_page_bridge })}`;
  const stockLabel = intl.formatMessage({
    id: ETranslations.perps_token_selector_stocks,
  });

  const segmentOptions = [
    {
      label: swapBridgeLabel,
      value: ESwapTabSwitchType.SWAP,
    },
    {
      label: stockLabel,
      value: ESwapTabSwitchType.STOCK,
    },
    {
      label: intl.formatMessage({
        id: showSwapPro
          ? ETranslations.dexmarket_pro
          : ETranslations.swap_page_limit,
      }),
      value: ESwapTabSwitchType.LIMIT,
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
  const tabs = (
    <>
      <CustomTabItem
        compact={isCompactLayout}
        isSelected={swapTypeSwitch === ESwapTabSwitchType.SWAP}
        onPress={() => {
          void handleSwapTypeChange(ESwapTabSwitchType.SWAP);
        }}
      >
        {swapBridgeLabel}
      </CustomTabItem>
      <CustomTabItem
        compact={isCompactLayout}
        isSelected={swapTypeSwitch === ESwapTabSwitchType.STOCK}
        onPress={() => {
          void handleSwapTypeChange(ESwapTabSwitchType.STOCK);
        }}
      >
        {stockLabel}
      </CustomTabItem>
      <CustomTabItem
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
        <ScrollableFilterBar itemGap="$1.5" itemPr="$5">
          {tabs}
        </ScrollableFilterBar>
      </Stack>
      {!hideRightActions ? (
        <SwapHeaderRightActionContainer
          pageType={pageType}
          marketPresetSettings={marketPresetSettings}
          compact={isCompactLayout}
        />
      ) : null}
    </XStack>
  );
};

export default memo(SwapHeaderContainer);
