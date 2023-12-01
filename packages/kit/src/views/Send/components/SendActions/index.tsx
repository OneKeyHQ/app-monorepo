import { Button, XStack } from '@onekeyhq/components';

type IProps = {
  onConfirm: () => void;
  onCancel: () => void;
};

function SendActions(props: IProps) {
  const { onConfirm, onCancel } = props;
  return (
    <XStack space="$4">
      <Button onPress={onCancel}>Cancel</Button>
      <Button variant="primary" onPress={onConfirm}>
        Confirm
      </Button>
    </XStack>
  );
}
export { SendActions };
