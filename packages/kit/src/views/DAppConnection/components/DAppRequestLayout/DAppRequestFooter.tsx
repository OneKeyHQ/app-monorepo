import type { ICheckedState } from '@onekeyhq/components';
import { Checkbox, Page } from '@onekeyhq/components';

function DAppRequestFooter({
  continueOperate,
  setContinueOperate,
  onConfirm,
  onCancel,
  confirmDisabled,
}: {
  continueOperate: boolean;
  setContinueOperate: (checked: ICheckedState) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirmDisabled?: boolean;
}) {
  return (
    <Page.FooterActions
      alignItems="center"
      flexDirection="row"
      justifyContent="space-between"
      space="$2.5"
      onConfirm={onConfirm}
      onCancel={onCancel}
      confirmButtonProps={{
        variant: 'destructive',
      }}
      cancelButtonProps={{
        variant: 'secondary',
        disabled: confirmDisabled,
      }}
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
    </Page.FooterActions>
  );
}

export { DAppRequestFooter };
