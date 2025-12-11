import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog, Icon, SizableText, XStack } from '@onekeyhq/components';
import SlippageSettingDialog from '@onekeyhq/kit/src/components/SlippageSettingDialog';
import { useSwapProSlippageAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { swapSlippageWillAheadMinValue } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapSlippageSegmentItem } from '@onekeyhq/shared/types/swap/types';
import { ESwapSlippageSegmentKey } from '@onekeyhq/shared/types/swap/types';

export interface ISwapProSlippageSettingProps {
  autoDefaultValue?: number;
  isMEV?: boolean;
}

export function SwapProSlippageSetting({
  isMEV = false,
  autoDefaultValue = 0.5,
}: ISwapProSlippageSettingProps) {
  const intl = useIntl();
  const [slippageItem, setSlippageItem] = useSwapProSlippageAtom();

  const slippageOnSave = useCallback(
    (item: ISwapSlippageSegmentItem, closeFn?: IDialogInstance['close']) => {
      setSlippageItem(item);
      if (closeFn) {
        void closeFn({ flag: 'save' });
      }
    },
    [setSlippageItem],
  );

  const onSlippageHandleClick = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({ id: ETranslations.slippage_tolerance_title }),
      renderContent: (
        <SlippageSettingDialog
          swapSlippage={slippageItem}
          autoValue={autoDefaultValue}
          onSave={slippageOnSave}
          isMEV={isMEV}
        />
      ),
    });
  }, [intl, slippageItem, autoDefaultValue, slippageOnSave, isMEV]);

  const displaySlippageText = useMemo(() => {
    if (slippageItem.key === ESwapSlippageSegmentKey.AUTO) {
      return `${intl.formatMessage({
        id: ETranslations.slippage_tolerance_switch_auto,
      })} (${slippageItem.value}%)`;
    }
    return `${intl.formatMessage({
      id: ETranslations.slippage_tolerance_switch_custom,
    })} (${slippageItem.value}%)`;
  }, [slippageItem, intl]);

  return (
    <XStack
      justifyContent="space-between"
      alignItems="center"
      userSelect="none"
      cursor="pointer"
      onPress={onSlippageHandleClick}
    >
      <XStack alignItems="center" gap="$1">
        <Icon name="ChartTrendingOutline" size="$4" color="$iconSubdued" />
        <SizableText
          size="$bodySm"
          color={
            slippageItem.key === ESwapSlippageSegmentKey.CUSTOM &&
            slippageItem.value > swapSlippageWillAheadMinValue
              ? '$textCaution'
              : '$text'
          }
        >
          {displaySlippageText}
        </SizableText>
        {isMEV ? (
          <Icon name="ShieldCheckDoneSolid" size="$4" color="$iconSuccess" />
        ) : null}
      </XStack>
      <Icon name="ChevronRightSmallOutline" size="$4" color="$iconSubdued" />
    </XStack>
  );
}
