import { TextAreaInput } from '@onekeyhq/components';

function DataViewer({ data }: { data: string }) {
  return (
    <TextAreaInput
      className="break-all"
      containerProps={{
        borderWidth: 0,
      }}
      textBreakStrategy="simple"
      fontSize={12}
      lineHeight={16}
      bg="$bg"
      h="$60"
      editable={false}
      value={data}
    />
  );
}

export { DataViewer };
