import { SizableText, Stack } from '@onekeyhq/components';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/kit-bg/src/services/ServiceFirmwareUpdate/ServiceFirmwareUpdate';

import { WalletAvatar } from '../../../components/WalletAvatar';

export function FirmwareUpdateWalletProfile({
  result,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
}) {
  return (
    <Stack
      onPress={() => {
        console.log('ICheckAllFirmwareReleaseResult', result);
      }}
    >
      <WalletAvatar img={result?.deviceType || 'unknown'} wallet={undefined} />
      <SizableText>{result?.deviceName || ''}</SizableText>
    </Stack>
  );
}
