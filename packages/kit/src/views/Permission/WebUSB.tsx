import { SizableText, Stack } from '@onekeyhq/components';
import { useSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export default function WebUSB() {
  const [settings] = useSettingsAtom();

  return (
    <Stack flex={1} bg="$bgApp" ai="center" jc="center">
      <SizableText> web usb</SizableText>
      <SizableText>{JSON.stringify(settings)}</SizableText>
    </Stack>
  );
}
