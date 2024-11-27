import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog } from '@onekeyhq/components';
import { useSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapSlippageSegmentItem } from '@onekeyhq/shared/types/swap/types';
import { ESwapSlippageSegmentKey } from '@onekeyhq/shared/types/swap/types';

import { useSwapSlippageDialogOpeningAtom } from '../../../states/jotai/contexts/swap';
import SwapSlippageContentContainer from '../pages/components/SwapSlippageContentContainer';

import { useSwapSlippagePercentageModeInfo } from './useSwapState';

export function useSwapSlippageActions() {
  const intl = useIntl();
  const { slippageItem, autoValue } = useSwapSlippagePercentageModeInfo();
  const [, setSwapSlippageDialogOpening] = useSwapSlippageDialogOpeningAtom();
  const [, setSettings] = useSettingsAtom();
  const dialogRef = useRef<ReturnType<typeof Dialog.show> | null>(null);
  const slippageOnSave = useCallback(
    (item: ISwapSlippageSegmentItem, close: IDialogInstance['close']) => {
      setSettings((v) => ({ ...v, swapSlippagePercentageMode: item.key }));
      if (item.key === ESwapSlippageSegmentKey.CUSTOM) {
        setSettings((v) => ({
          ...v,
          swapSlippagePercentageMode: item.key,
          swapSlippagePercentageCustomValue: item.value,
        }));
      }
      void close({ flag: 'save' });
    },
    [setSettings],
  );
  const onSlippageHandleClick = useCallback(() => {
    dialogRef.current = Dialog.show({
      title: intl.formatMessage({ id: ETranslations.slippage_tolerance_title }),
      renderContent: (
        <SwapSlippageContentContainer
          swapSlippage={slippageItem}
          autoValue={autoValue}
          onSave={slippageOnSave}
        />
      ),
      onOpen: () => {
        setSwapSlippageDialogOpening({ status: true });
      },
      onClose: (extra) => {
        setSwapSlippageDialogOpening({ status: false, flag: extra?.flag });
      },
    });
  }, [
    autoValue,
    intl,
    setSwapSlippageDialogOpening,
    slippageItem,
    slippageOnSave,
  ]);
  return {
    onSlippageHandleClick,
    slippageOnSave,
    slippageItem,
  };
}
