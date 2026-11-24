import { SizableText, Stack } from '@onekeyhq/components';

export function ChartUnavailable({
  height,
  testID,
}: {
  height?: number;
  testID?: string;
}) {
  return (
    <Stack
      flex={height === undefined ? 1 : undefined}
      h={height}
      w="100%"
      ai="center"
      jc="center"
      px="$4"
      testID={testID}
    >
      <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
        当前设备不支持显示图表
      </SizableText>
    </Stack>
  );
}
