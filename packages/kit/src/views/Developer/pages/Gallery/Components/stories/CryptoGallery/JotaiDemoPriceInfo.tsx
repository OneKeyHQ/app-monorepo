import {
  Button,
  DebugRenderTracker,
  SizableText,
  Stack,
} from '@onekeyhq/components';
import { useDemoPriceInfoAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/demo';

export function JotaiDemoPriceInfo() {
  const [demoPriceInfo, setDemoPriceInfo] = useDemoPriceInfoAtom();

  return (
    <DebugRenderTracker>
      <Stack>
        <SizableText size="$bodyMd">
          {JSON.stringify(demoPriceInfo, null, 2)}
        </SizableText>
        <Button
          variant="primary"
          onPress={() =>
            setDemoPriceInfo((prev) => ({ ...prev, price: 10, info: 'info' }))
          }
        >
          setDemoPriceInfo(new object)
        </Button>
        <Button
          variant="primary"
          onPress={() => setDemoPriceInfo((prev) => prev)}
        >
          setDemoPriceInfo(prev object)
        </Button>
      </Stack>
    </DebugRenderTracker>
  );
}
