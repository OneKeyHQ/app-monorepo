import { type FC, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { IconButton } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useScanQrCode from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCode';
import type {
  IChainValue,
  IQRCodeHandlerParseResult,
} from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EInputAddressChangeType } from '@onekeyhq/shared/types/address';
import {
  EQRCodeHandlerNames,
  EQRCodeHandlerType,
} from '@onekeyhq/shared/types/qrCode';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

import type { IAddressPluginProps } from '../types';

const ScanPluginContent: FC<IAddressPluginProps> = ({
  onChange,
  onInputTypeChange,
  testID,
  disabled,
}) => {
  const { start } = useScanQrCode();
  const intl = useIntl();
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });
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
    const tokenAddress = result?.data?.tokenAddress;
    const accountId = account?.id;
    const networkId = result?.data?.network?.id || network?.id || '';
    if (accountId) {
      const token = tokenAddress
        ? await backgroundApiProxy.serviceToken.getToken({
            networkId,
            accountId,
            tokenIdOnNetwork: tokenAddress,
          })
        : await backgroundApiProxy.serviceToken.getNativeToken({
            networkId,
            accountId: account.id,
          });
      console.log('token result', accountId, networkId, token);
    }
  }, [account?.id, network?.id, onChange, onInputTypeChange, start]);
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

type IScanPluginProps = IAddressPluginProps & {
  sceneName: EAccountSelectorSceneName;
};

export const ScanPlugin: FC<IScanPluginProps> = ({
  onChange,
  testID,
  sceneName,
  disabled,
}) => (
  <AccountSelectorProviderMirror
    config={{
      sceneName,
    }}
    enabledNum={[0]}
  >
    <ScanPluginContent
      onChange={onChange}
      testID={testID}
      disabled={disabled}
    />
  </AccountSelectorProviderMirror>
);
