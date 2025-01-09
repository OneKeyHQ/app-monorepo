import { ScrollView, SizableText } from '@onekeyhq/components';

function DataViewer({ data }: { data: string }) {
  return (
    <ScrollView
      p="$2.5"
      borderRadius="$2.5"
      borderCurve="continuous"
      bg="$bgSubdued"
      h="$60"
    >
      <SizableText
        size="$bodySm"
        style={{
          wordBreak: 'break-all',
        }}
      >
        {data}
      </SizableText>
    </ScrollView>
  );
}

export { DataViewer };
