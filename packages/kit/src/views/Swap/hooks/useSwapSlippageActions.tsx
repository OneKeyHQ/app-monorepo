import { useCallback, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog } from '@onekeyhq/components';
import { useSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { ISwapSlippageSegmentItem } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapDirectionType,
  ESwapSlippageSegmentKey,
} from '@onekeyhq/shared/types/swap/types';

import SlippageSettingDialog from '../../../components/SlippageSettingDialog';
import {
  useSwapMevConfigAtom,
  useSwapSlippageDialogOpeningAtom,
} from '../../../states/jotai/contexts/swap';

import { useSwapAddressInfo } from './useSwapAccount';
import { useSwapSlippagePercentageModeInfo } from './useSwapState';

export function useSwapSlippageActions() {
  const intl = useIntl();
  const { slippageItem, autoValue } = useSwapSlippagePercentageModeInfo();
  const [, setSwapSlippageDialogOpening] = useSwapSlippageDialogOpeningAtom();
  const [swapMevConfig] = useSwapMevConfigAtom();
  const [, setSettings] = useSettingsAtom();
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const isMEV = useMemo(() => {
    return (
      !accountUtils.isExternalWallet({
        walletId: swapFromAddressInfo.accountInfo?.wallet?.id,
      }) &&
      swapMevConfig.swapMevNetConfig.includes(
        swapFromAddressInfo.accountInfo?.network?.id ?? '',
      )
    );
  }, [
    swapFromAddressInfo.accountInfo?.wallet?.id,
    swapFromAddressInfo.accountInfo?.network?.id,
    swapMevConfig.swapMevNetConfig,
  ]);
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
        <SlippageSettingDialog
          swapSlippage={slippageItem}
          autoValue={autoValue}
          onSave={slippageOnSave}
          isMEV={isMEV}
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
    isMEV,
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
