import { memo, useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import type { EPageType, IStackProps } from '@onekeyhq/components';
import {
  SegmentControl,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useSwapActions,
  useSwapSelectFromTokenAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ESwapDirectionType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapAddressInfo } from '../../hooks/useSwapAccount';

import SwapHeaderRightActionContainer from './SwapHeaderRightActionContainer';

type ICustomTabItemProps = IStackProps & {
  isSelected?: boolean;
  onPress?: IStackProps['onPress'];
};

function CustomTabItem({
  children,
  isSelected,
  onPress,
  ...rest
}: ICustomTabItemProps) {
  return (
    <Stack
      py="$1"
      px="$2.5"
      borderRadius="$2"
      borderCurve="continuous"
      userSelect="none"
      hitSlop={{
        top: 4,
        bottom: 4,
      }}
      {...(isSelected
        ? {
            bg: '$bgSubdued',
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
}

const SwapHeaderContainer = ({
  pageType,
  defaultSwapType,
  showSwapPro,
  hideRightActions,
}: ISwapHeaderContainerProps) => {
  const intl = useIntl();
  const { gtLg } = useMedia();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const { swapTypeSwitchAction } = useSwapActions().current;
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

  const handleSwapTypeChange = useCallback(
    async (value: string | number) => {
      const newType = value as ESwapTabSwitchType;
      if (swapTypeSwitch === newType) return;

      if (newType === ESwapTabSwitchType.LIMIT) {
        void swapTypeSwitchAction(ESwapTabSwitchType.LIMIT, networkId);
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
      networkId,
      fromToken?.networkId,
      updateSelectedAccountNetworkAction,
    ],
  );

  // Desktop layout (gtLg and not modal): use SegmentControl
  const showDesktopLayout =
    gtLg && pageType !== 'modal' && !platformEnv.isNative;

  const segmentOptions = [
    {
      label: intl.formatMessage({ id: ETranslations.swap_page_swap }),
      value: ESwapTabSwitchType.SWAP,
    },
    {
      label: intl.formatMessage({ id: ETranslations.swap_page_bridge }),
      value: ESwapTabSwitchType.BRIDGE,
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
          value={swapTypeSwitch}
          options={segmentOptions.map((opt) => ({
            ...opt,
            label: (
              <SizableText
                size="$headingSm"
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
            px: '$7',
            borderRadius: '$full',
            '$platform-web': {
              boxShadow: 'none',
            },
          }}
        />
      </XStack>
    );
  }

  return (
    <XStack justifyContent="space-between" px="$5" py="$1">
      <XStack gap="$3">
        <CustomTabItem
          isSelected={swapTypeSwitch === ESwapTabSwitchType.SWAP}
          onPress={async () => {
            if (swapTypeSwitch !== ESwapTabSwitchType.SWAP) {
              if (fromToken?.networkId && fromToken?.networkId !== networkId) {
                await updateSelectedAccountNetworkAction(fromToken?.networkId);
              }
              void swapTypeSwitchAction(
                ESwapTabSwitchType.SWAP,
                fromToken?.networkId || networkId,
              );
            }
          }}
        >
          {intl.formatMessage({ id: ETranslations.swap_page_swap })}
        </CustomTabItem>

        <CustomTabItem
          isSelected={swapTypeSwitch === ESwapTabSwitchType.BRIDGE}
          onPress={async () => {
            if (swapTypeSwitch !== ESwapTabSwitchType.BRIDGE) {
              if (fromToken?.networkId && fromToken?.networkId !== networkId) {
                await updateSelectedAccountNetworkAction(fromToken?.networkId);
              }
              void swapTypeSwitchAction(
                ESwapTabSwitchType.BRIDGE,
                fromToken?.networkId || networkId,
              );
            }
          }}
        >
          {intl.formatMessage({ id: ETranslations.swap_page_bridge })}
        </CustomTabItem>
        <CustomTabItem
          isSelected={swapTypeSwitch === ESwapTabSwitchType.LIMIT}
          onPress={() => {
            if (swapTypeSwitch !== ESwapTabSwitchType.LIMIT) {
              void swapTypeSwitchAction(ESwapTabSwitchType.LIMIT, networkId);
            }
          }}
        >
          {intl.formatMessage({
            id: showSwapPro
              ? ETranslations.dexmarket_pro
              : ETranslations.swap_page_limit,
          })}
        </CustomTabItem>
      </XStack>
      {!hideRightActions ? (
        <SwapHeaderRightActionContainer pageType={pageType} />
      ) : null}
    </XStack>
  );
};

export default memo(SwapHeaderContainer);
