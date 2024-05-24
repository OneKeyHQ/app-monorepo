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
      <WalletAvatar
        size="$14"
        img={result?.deviceType || 'unknown'}
        wallet={undefined}
      />
      <SizableText mt="$5" size="$heading2xl">
        New hardware updates 🎉
      </SizableText>
    </Stack>
  );
}
