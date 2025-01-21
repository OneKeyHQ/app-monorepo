import { TextAreaInput } from '@onekeyhq/components';

function DataViewer({ data }: { data: string }) {
  return (
    <TextAreaInput
      containerProps={{
        borderWidth: 0,
      }}
      fontSize={12}
      whiteSpace="pre"
      lineHeight={16}
      bg="$bg"
      h="$60"
      editable={false}
      value={data}
    />
  );
}

export { DataViewer };
