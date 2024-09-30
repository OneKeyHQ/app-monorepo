import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Dialog,
  EPageType,
  SegmentControl,
  SizableText,
  XStack,
} from '@onekeyhq/components';
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

interface ISwapHeaderContainerProps {
  pageType?: EPageType;
}

const SwapHeaderContainer = ({ pageType }: ISwapHeaderContainerProps) => {
  const intl = useIntl();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const { swapTypeSwitchAction } = useSwapActions().current;
  const { networkId } = useSwapAddressInfo(ESwapDirectionType.FROM);
  const headerRight = useCallback(() => <SwapHeaderRightActionContainer />, []);

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

  if (pageType !== EPageType.modal) {
    return (
      <XStack justifyContent="space-between">
        <XStack gap="$5">
          <SizableText
            size="$headingLg"
            userSelect="none"
            cursor="pointer"
            opacity={swapTypeSwitch !== ESwapTabSwitchType.SWAP ? 0.5 : 1}
            onPress={() => {
              if (swapTypeSwitch !== ESwapTabSwitchType.SWAP) {
                void swapTypeSwitchAction(ESwapTabSwitchType.SWAP, networkId);
              }
            }}
          >
            {intl.formatMessage({ id: ETranslations.swap_page_swap })}
          </SizableText>

          <SizableText
            size="$headingLg"
            userSelect="none"
            cursor="pointer"
            opacity={swapTypeSwitch !== ESwapTabSwitchType.BRIDGE ? 0.5 : 1}
            onPress={() => {
              if (swapTypeSwitch !== ESwapTabSwitchType.BRIDGE) {
                void swapTypeSwitchAction(ESwapTabSwitchType.BRIDGE, networkId);
              }
            }}
          >
            {intl.formatMessage({ id: ETranslations.swap_page_swap })}
          </SizableText>

          <XStack
            opacity={swapTypeSwitch !== ESwapTabSwitchType.LIMIT ? 0.5 : 1}
            gap="$1"
            onPress={onSwapLimit}
            cursor="pointer"
          >
            <SizableText size="$headingLg" userSelect="none">
              {intl.formatMessage({ id: ETranslations.swap_page_limit })}
            </SizableText>
            <Badge badgeSize="sm" badgeType="default">
              {intl.formatMessage({ id: ETranslations.coming_soon })}
            </Badge>
          </XStack>
        </XStack>
        {headerRight()}
      </XStack>
    );
  }
  return (
    <XStack justifyContent="center" alignItems="center">
      <XStack minWidth={320}>
        <SegmentControl
          fullWidth
          value={swapTypeSwitch}
          options={[
            {
              label: intl.formatMessage({ id: ETranslations.swap_page_swap }),
              value: ESwapTabSwitchType.SWAP,
            },
            {
              label: intl.formatMessage({ id: ETranslations.swap_page_swap }),
              value: ESwapTabSwitchType.BRIDGE,
            },
          ]}
          onChange={(value) => {
            void swapTypeSwitchAction(value as ESwapTabSwitchType, networkId);
          }}
        />
      </XStack>
    </XStack>
  );
};

export default memo(SwapHeaderContainer);
