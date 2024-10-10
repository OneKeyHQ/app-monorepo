import { memo, useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import type { EPageType, IStackProps } from '@onekeyhq/components';
import { Dialog, SizableText, Stack, XStack } from '@onekeyhq/components';
import {
  useSwapActions,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
  pageType?: EPageType;
  defaultSwapType?: ESwapTabSwitchType;
}

const SwapHeaderContainer = ({
  pageType,
  defaultSwapType,
}: ISwapHeaderContainerProps) => {
  const intl = useIntl();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const { swapTypeSwitchAction } = useSwapActions().current;
  const { networkId } = useSwapAddressInfo(ESwapDirectionType.FROM);
  const headerRight = useCallback(() => <SwapHeaderRightActionContainer />, []);
  useEffect(() => {
    if (defaultSwapType) {
      void swapTypeSwitchAction(defaultSwapType, networkId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onSwapLimit = useCallback(() => {
    Dialog.confirm({
      icon: 'InfoCircleOutline',
      showCancelButton: false,
      onConfirmText: intl.formatMessage({
        id: ETranslations.swap_page_limit_dialog_button,
      }),
      title: intl.formatMessage({
        id: ETranslations.swap_page_limit_dialog_title,
      }),
      description: intl.formatMessage({
        id: ETranslations.swap_page_limit_dialog_content,
      }),
    });
  }, [intl]);

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
