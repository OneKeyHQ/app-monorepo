import type { IButtonProps, ICheckedState } from '@onekeyhq/components';
import { Button, Checkbox, Stack, XStack } from '@onekeyhq/components';

function DAppRequestFooter({
  continueOperate,
  setContinueOperate,
  onConfirm,
  onCancel,
}: {
  continueOperate: boolean;
  setContinueOperate: (checked: ICheckedState) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Stack
      p="$5"
      alignItems="center"
      flexDirection="row"
      justifyContent="space-between"
      space="$2.5"
      $md={{
        flexDirection: 'column',
        alignItems: 'flex-start',
      }}
    >
      <Checkbox
        label="Proceed at my own risk"
        value={continueOperate}
        onChange={setContinueOperate}
      />
      <XStack
        justifyContent="flex-end"
        space="$2.5"
        $md={{
          flex: 1,
          w: '100%',
        }}
      >
        <Button
          $md={
            {
              flex: 1,
              size: 'large',
            } as IButtonProps
          }
          variant="secondary"
          onPress={onCancel}
        >
          Cancel
        </Button>
        <Button
          $md={
            {
              flex: 1,
              size: 'large',
            } as IButtonProps
          }
          variant="destructive"
          onPress={onConfirm}
        >
          Confirm
        </Button>
      </XStack>
    </Stack>
  );
}

export { DAppRequestFooter };
