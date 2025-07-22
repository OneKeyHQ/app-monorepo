import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog, Icon, SizableText, XStack } from '@onekeyhq/components';
import SlippageSettingDialog from '@onekeyhq/kit/src/components/SlippageSettingDialog';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { swapSlippageWillAheadMinValue } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapSlippageSegmentItem } from '@onekeyhq/shared/types/swap/types';
import { ESwapSlippageSegmentKey } from '@onekeyhq/shared/types/swap/types';

import { InfoItemLabel } from '../InfoItemLabel/InfoItemLabel';

export interface ISlippageSettingProps {
  autoDefaultValue?: number;
  isMEV?: boolean;
  onSlippageChange?: (item: ISwapSlippageSegmentItem) => void;
}

export function SlippageSetting({
  isMEV = false,
  autoDefaultValue = 0.5,
  onSlippageChange,
}: ISlippageSettingProps) {
  const intl = useIntl();
  const [slippageItem, setSlippageItem] = useState<ISwapSlippageSegmentItem>({
    key: ESwapSlippageSegmentKey.AUTO,
    value: autoDefaultValue,
  });

  const slippageOnSave = useCallback(
    (item: ISwapSlippageSegmentItem, closeFn?: IDialogInstance['close']) => {
      console.log('Slippage saved:', item);
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
      <InfoItemLabel
        title={intl.formatMessage({
          id: ETranslations.swap_page_provider_slippage_tolerance,
        })}
        questionMarkContent={intl.formatMessage({
          id: ETranslations.slippage_tolerance_popover,
        })}
      />

      <XStack onPress={onSlippageHandleClick} alignItems="center" gap="$1">
        {isMEV ? (
          <Icon name="ShieldCheckDoneSolid" size="$5" color="$iconSuccess" />
        ) : null}
        <SizableText
          size="$bodyMd"
          color={
            slippageItem.key === ESwapSlippageSegmentKey.CUSTOM &&
            slippageItem.value > swapSlippageWillAheadMinValue
              ? '$textCaution'
              : '$textSubdued'
          }
        >
          {displaySlippageText}
        </SizableText>
        <Icon name="ChevronRightSmallOutline" size="$5" color="$iconSubdued" />
      </XStack>
    </XStack>
  );
}
