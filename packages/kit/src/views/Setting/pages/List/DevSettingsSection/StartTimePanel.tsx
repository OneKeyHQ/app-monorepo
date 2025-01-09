import { SizableText, YStack } from '@onekeyhq/components';
import { useMeasureTime } from '@onekeyhq/shared/src/modules3rdParty/metrics';

export function StartTimePanel() {
  const { jsBundleLoadedTime, fpTime } = useMeasureTime();
  return (
    <YStack>
      <SizableText>JS Bundle 加载执行时长: {jsBundleLoadedTime}</SizableText>
      <SizableText>界面渲染时长: {fpTime - jsBundleLoadedTime}</SizableText>
      <SizableText>启动总时长: {fpTime}</SizableText>
    </YStack>
  );
}
