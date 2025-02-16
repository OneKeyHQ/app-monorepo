import { TextAreaInput } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

function DataViewer({ data }: { data: string }) {
  return (
    <TextAreaInput
      caretHidden={platformEnv.isNativeAndroid}
      className="break-all"
      containerProps={{
        borderWidth: 0,
      }}
      textBreakStrategy="simple"
      fontSize={12}
      lineHeight={16}
      bg="$bg"
      h="$60"
      editable={platformEnv.isNativeAndroid}
      showSoftInputOnFocus={false}
      value={data}
    />
  );
}

export { DataViewer };
