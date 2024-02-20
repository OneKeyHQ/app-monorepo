import { Spinner, Stack } from '@onekeyhq/components';

type IProps = {
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
};

function ListLoading(props: IProps) {
  const { onContentSizeChange } = props;
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      mt="$24"
      onLayout={(event) =>
        onContentSizeChange?.(
          event.nativeEvent.layout.width,
          event.nativeEvent.layout.height,
        )
      }
    >
      <Spinner size="large" />
    </Stack>
  );
}

export { ListLoading };
