import { type FC, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { IconButton } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useScanQrCode from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCode';
import type {
  IChainValue,
  IQRCodeHandlerParseResult,
} from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EInputAddressChangeType } from '@onekeyhq/shared/types/address';
import {
  EQRCodeHandlerNames,
  EQRCodeHandlerType,
} from '@onekeyhq/shared/types/qrCode';
import type { IToken } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { getAccountIdOnNetwork } from '../../../views/ScanQrCode/hooks/useParseQRCode';

import type { IAddressPluginProps } from '../types';

const ScanPluginContent: FC<
  IAddressPluginProps & {
    onScanResult?: IScanPluginProps['onScanResult'];
  }
> = ({ onChange, onInputTypeChange, testID, disabled, onScanResult }) => {
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
      ],
      autoHandleResult: false,
    })) as IQRCodeHandlerParseResult<IChainValue>;
    console.log('scaned result', result);
    onChange?.(
      result.type === EQRCodeHandlerType.UNKNOWN
        ? result.raw
        : result?.data?.address,
    );
    onInputTypeChange?.(EInputAddressChangeType.Scan);

    setTimeout(() => {
      onScanResult?.(result);
    }, 120);
  }, [onChange, onInputTypeChange, onScanResult, start]);
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
};

export type IScanPluginProps = IAddressPluginProps & {
  sceneName: EAccountSelectorSceneName;
  onScanResult?: (result: IQRCodeHandlerParseResult<IChainValue>) => void;
};

export const ScanPlugin: FC<IScanPluginProps> = ({
  onChange,
  testID,
  disabled,
  onScanResult,
}) => (
  <ScanPluginContent
    onChange={onChange}
    testID={testID}
    disabled={disabled}
    onScanResult={onScanResult}
  />
);
