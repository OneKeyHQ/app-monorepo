import type { ICheckedState } from '@onekeyhq/components';
import { Checkbox, Page, useMedia } from '@onekeyhq/components';
import type { IFooterActionsProps } from '@onekeyhq/components/src/layouts/Page/PageFooterActions';

function DAppRequestFooter({
  continueOperate,
  setContinueOperate,
  showContinueOperateCheckbox,
  onConfirm,
  onCancel,
  confirmButtonProps,
}: {
  continueOperate: boolean;
  setContinueOperate: (checked: ICheckedState) => void;
  showContinueOperateCheckbox?: boolean;
  onConfirm: IFooterActionsProps['onConfirm'];
  onCancel: IFooterActionsProps['onCancel'];
  confirmButtonProps?: IFooterActionsProps['confirmButtonProps'];
}) {
  const media = useMedia();
  return (
    <Page.FooterActions
      alignItems="center"
      flexDirection="row"
      justifyContent={
        showContinueOperateCheckbox ? 'space-between' : 'flex-end'
      }
      space="$2.5"
      onConfirm={onConfirm}
      onCancel={onCancel}
      confirmButtonProps={{
        variant: 'destructive',
        ...confirmButtonProps,
      }}
      cancelButtonProps={{
        variant: 'secondary',
      }}
      $md={{
        flexDirection: 'column',
        alignItems: 'flex-start',
      }}
      buttonContainerProps={{
        w: media.md ? '100%' : 'auto',
      }}
    >
      {showContinueOperateCheckbox && (
        <Checkbox
          label="Proceed at my own risk"
          value={continueOperate}
          onChange={setContinueOperate}
        />
      )}
    </Page.FooterActions>
  );
}

export { DAppRequestFooter };
