import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog, Icon, SizableText, XStack } from '@onekeyhq/components';
import SlippageSettingDialog from '@onekeyhq/kit/src/components/SlippageSettingDialog';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { swapSlippageWillAheadMinValue } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapSlippageSegmentItem } from '@onekeyhq/shared/types/swap/types';
import { ESwapSlippageSegmentKey } from '@onekeyhq/shared/types/swap/types';

export interface ISwapProSlippageSettingProps {
  autoDefaultValue?: number;
  isMEV?: boolean;
  onSlippageChange?: (item: ISwapSlippageSegmentItem) => void;
}

export function SwapProSlippageSetting({
  isMEV = false,
  autoDefaultValue = 0.5,
  onSlippageChange,
}: ISwapProSlippageSettingProps) {
  const intl = useIntl();
  const [slippageItem, setSlippageItem] = useState<ISwapSlippageSegmentItem>({
    key: ESwapSlippageSegmentKey.AUTO,
    value: autoDefaultValue,
  });

  const slippageOnSave = useCallback(
    (item: ISwapSlippageSegmentItem, closeFn?: IDialogInstance['close']) => {
      setSlippageItem(item);
      onSlippageChange?.(item);
      if (closeFn) {
        void closeFn({ flag: 'save' });
      }
    },
    [onSlippageChange],
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
      onOpen: () => {
        console.log('Slippage dialog opened');
      },
      onClose: (extra) => {
        console.log('Slippage dialog closed', extra);
      },
    });
  }, [intl, slippageItem, autoDefaultValue, slippageOnSave, isMEV]);

  const displaySlippageText = useMemo(() => {
    if (slippageItem.key === ESwapSlippageSegmentKey.AUTO) {
      return `${intl.formatMessage({
        id: ETranslations.slippage_tolerance_switch_auto,
      })} (${autoDefaultValue}%)`;
    }
    return `${slippageItem.value}%`;
  }, [slippageItem, intl, autoDefaultValue]);

  return (
    <XStack
      justifyContent="space-between"
      alignItems="center"
      userSelect="none"
      cursor="pointer"
    >
      <XStack onPress={onSlippageHandleClick} alignItems="center" gap="$1">
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
