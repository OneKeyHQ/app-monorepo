import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog, Icon, SizableText, XStack } from '@onekeyhq/components';
import SlippageSettingDialog from '@onekeyhq/kit/src/components/SlippageSettingDialog';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapSlippageSegmentItem } from '@onekeyhq/shared/types/swap/types';
import { ESwapSlippageSegmentKey } from '@onekeyhq/shared/types/swap/types';

export function SlippageSetting() {
  const intl = useIntl();
  const [slippageItem, setSlippageItem] = useState<ISwapSlippageSegmentItem>({
    key: ESwapSlippageSegmentKey.AUTO,
    value: 0.5,
  });
  const autoValue = 0.5;
  const isMEV = false;

  const slippageOnSave = useCallback(
    (item: ISwapSlippageSegmentItem, closeFn?: IDialogInstance['close']) => {
      console.log('Slippage saved:', item);
      setSlippageItem(item);
      if (closeFn) {
        void closeFn({ flag: 'save' });
      }
    },
    [],
  );

  const onSlippageHandleClick = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({ id: ETranslations.slippage_tolerance_title }),
      renderContent: (
        <SlippageSettingDialog
          swapSlippage={slippageItem}
          autoValue={autoValue}
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
  }, [intl, slippageItem, autoValue, slippageOnSave, isMEV]);

  const displaySlippageText = useMemo(() => {
    if (slippageItem.key === ESwapSlippageSegmentKey.AUTO) {
      return `${intl.formatMessage({
        id: ETranslations.slippage_tolerance_switch_auto,
      })} (${autoValue}%)`;
    }
    return `${slippageItem.value}%`;
  }, [slippageItem, intl, autoValue]);

  return (
    <XStack
      justifyContent="space-between"
      alignItems="center"
      onPress={onSlippageHandleClick}
      userSelect="none"
      cursor="pointer"
    >
      <XStack alignItems="center" gap="$1">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.slippage_tolerance_title })}
        </SizableText>
        <Icon name="QuestionmarkOutline" size="$5" color="$iconSubdued" />
      </XStack>

      <XStack alignItems="center" gap="$1">
        <SizableText size="$bodyMd" color="$textSubdued">
          {displaySlippageText}
        </SizableText>
        <Icon name="ChevronRightSmallOutline" size="$5" color="$iconSubdued" />
      </XStack>
    </XStack>
  );
}
