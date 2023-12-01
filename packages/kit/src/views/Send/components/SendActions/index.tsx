import { Button, XStack } from '@onekeyhq/components';

type IProps = {
  onConfirm: () => void;
};

function SendActions(props: IProps) {
  const { onConfirm } = props;
  return (
    <XStack space="$4">
      <Button>Cancel</Button>
      <Button variant="primary" onPress={onConfirm}>
        Confirm
      </Button>
    </XStack>
  );
}
export { SendActions };
