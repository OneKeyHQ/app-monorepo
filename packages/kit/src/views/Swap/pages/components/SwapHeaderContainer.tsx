import { memo, useCallback, useEffect } from 'react';

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
            {intl.formatMessage({ id: ETranslations.swap_page_bridge })}
          </SizableText>

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
              label: intl.formatMessage({ id: ETranslations.swap_page_bridge }),
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
