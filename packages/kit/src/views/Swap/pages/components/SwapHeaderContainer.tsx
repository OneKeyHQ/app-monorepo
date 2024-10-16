import { memo, useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import type { IStackProps } from '@onekeyhq/components';
import { SizableText, Stack, XStack } from '@onekeyhq/components';
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
            bg: '$bgActive',
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
  // pageType?: EPageType;
  defaultSwapType?: ESwapTabSwitchType;
}

const SwapHeaderContainer = ({
  // pageType,
  defaultSwapType,
}: ISwapHeaderContainerProps) => {
  const intl = useIntl();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const { swapTypeSwitchAction } = useSwapActions().current;
  const { networkId } = useSwapAddressInfo(ESwapDirectionType.FROM);
  const [fromToken] = useSwapSelectFromTokenAtom();
  const headerRight = useCallback(() => <SwapHeaderRightActionContainer />, []);
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

  return (
    <XStack justifyContent="space-between">
      <XStack gap="$3">
        <CustomTabItem
          isSelected={swapTypeSwitch === ESwapTabSwitchType.SWAP}
          onPress={() => {
            if (swapTypeSwitch !== ESwapTabSwitchType.SWAP) {
              void swapTypeSwitchAction(ESwapTabSwitchType.SWAP, networkId);
            }
          }}
        >
          {intl.formatMessage({ id: ETranslations.swap_page_swap })}
        </CustomTabItem>

        <CustomTabItem
          isSelected={swapTypeSwitch === ESwapTabSwitchType.BRIDGE}
          onPress={() => {
            if (swapTypeSwitch !== ESwapTabSwitchType.BRIDGE) {
              void swapTypeSwitchAction(ESwapTabSwitchType.BRIDGE, networkId);
            }
          }}
        >
          {intl.formatMessage({ id: ETranslations.swap_page_bridge })}
        </CustomTabItem>
      </XStack>
      {headerRight()}
    </XStack>
  );
};

export default memo(SwapHeaderContainer);
