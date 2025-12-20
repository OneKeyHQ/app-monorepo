import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { IconButton } from '@onekeyhq/components';
import useScanQrCode from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCode';
import type {
  IChainValue,
  IQRCodeHandlerParseResult,
} from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EInputAddressChangeType } from '@onekeyhq/shared/types/address';
import {
  EQRCodeHandlerNames,
  EQRCodeHandlerType,
} from '@onekeyhq/shared/types/qrCode';

import type { IAddressPluginProps } from '../types';

export type IScanPluginProps = IAddressPluginProps & {
  networkId: string;
  onScanResult?: (result: IQRCodeHandlerParseResult<IChainValue>) => void;
};

export function ScanPlugin({
  onChange,
  testID,
  disabled,
  onScanResult,
  onInputTypeChange,
  networkId,
}: IScanPluginProps) {
  const { start } = useScanQrCode();
  const intl = useIntl();
  const onPress = useCallback(async () => {
    const result = (await start({
      handlers: [
        EQRCodeHandlerNames.bitcoin,
        EQRCodeHandlerNames.ethereum,
        EQRCodeHandlerNames.solana,
        EQRCodeHandlerNames.walletconnect,
        EQRCodeHandlerNames.sui,
        EQRCodeHandlerNames.lightningNetwork,
      ],
      autoHandleResult: false,
    })) as IQRCodeHandlerParseResult<IChainValue>;
    console.log('scaned result', result);
    onChange?.(
      result.type === EQRCodeHandlerType.UNKNOWN ||
        result?.data?.network?.id !== networkId
        ? result.raw
        : result?.data?.address,
    );
    onInputTypeChange?.(EInputAddressChangeType.Scan);

    setTimeout(() => {
      onScanResult?.(result);
    }, 120);
  }, [networkId, onChange, onInputTypeChange, onScanResult, start]);
  return (
    <IconButton
      title={intl.formatMessage({ id: ETranslations.send_to_scan_tooltip })}
      variant="tertiary"
      icon="ScanSolid"
      onPress={disabled ? undefined : onPress}
      testID={testID}
      disabled={disabled}
    />
  );
}
