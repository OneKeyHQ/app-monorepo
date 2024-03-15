import { SizableText, YStack } from '@onekeyhq/components';
import { useMeasureTime } from '@onekeyhq/shared/src/modules3rdParty/metrics';

export function StartTimePanel() {
  const { jsBundleLoadedTime, fpTime } = useMeasureTime();
  return (
    <YStack>
      <SizableText>Load Time: {jsBundleLoadedTime}</SizableText>
      <SizableText>Render time: {fpTime - jsBundleLoadedTime}</SizableText>
      <SizableText>Startup Time: {fpTime}</SizableText>
    </YStack>
  );
}
