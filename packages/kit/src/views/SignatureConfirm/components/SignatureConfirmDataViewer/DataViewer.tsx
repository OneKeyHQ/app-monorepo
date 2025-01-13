import { ScrollView, SizableText, Stack } from '@onekeyhq/components';

function DataViewer({ data }: { data: string }) {
  return (
    <ScrollView
      p="$2.5"
      borderRadius="$2.5"
      borderCurve="continuous"
      bg="$bgSubdued"
      h="$60"
    >
      <Stack pb="$6">
        <SizableText
          size="$bodySm"
          style={{
            wordBreak: 'break-all',
          }}
        >
          {data}
        </SizableText>
      </Stack>
    </ScrollView>
  );
}

export { DataViewer };
