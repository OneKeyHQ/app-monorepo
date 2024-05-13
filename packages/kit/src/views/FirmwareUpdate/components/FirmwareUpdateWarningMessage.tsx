import { SizableText, Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function FirmwareUpdateWarningMessage() {
  return (
    <Stack backgroundColor="$bgCautionSubdued" py="$3" px="$5" mb="$6">
      <SizableText>
        {platformEnv.isNative
          ? 'Keep Bluetooth connected and app active during the upgrade.'
          : 'Keep USB connected and app active during the upgrade.'}
      </SizableText>
    </Stack>
  );
}
