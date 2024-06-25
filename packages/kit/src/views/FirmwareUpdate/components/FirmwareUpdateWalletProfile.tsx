import { useIntl } from 'react-intl';

import { SizableText, Stack } from '@onekeyhq/components';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/kit-bg/src/services/ServiceFirmwareUpdate/ServiceFirmwareUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { DeviceAvatar } from '../../../components/DeviceAvatar';

export function FirmwareUpdateWalletProfile({
  result,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
}) {
  const intl = useIntl();
  return (
    <Stack
      onPress={() => {
        console.log('ICheckAllFirmwareReleaseResult', result);
      }}
    >
      {/* 
      <WalletAvatar
        size="$14"
        img={result?.deviceType || 'unknown'}
        wallet={undefined}
      /> 
      */}
      <DeviceAvatar size="$14" deviceType={result?.deviceType || 'unknown'} />
      {/* <SizableText>{result?.deviceName || ''}</SizableText> */}
      <SizableText mt="$5" size="$heading2xl">
        {intl.formatMessage({ id: ETranslations.update_new_hardware_updates })}{' '}
      </SizableText>
    </Stack>
  );
}
