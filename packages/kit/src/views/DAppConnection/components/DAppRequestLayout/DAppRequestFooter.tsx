import { useIntl } from 'react-intl';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { ICheckedState } from '@onekeyhq/components';
import { Checkbox, Page, useMedia } from '@onekeyhq/components';
import type { IFooterActionsProps } from '@onekeyhq/components/src/layouts/Page/PageFooterActions';
import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';

function DAppRequestFooter({
  continueOperate,
  setContinueOperate,
  showContinueOperateCheckbox,
  onConfirm,
  onCancel,
  confirmButtonProps,
  riskLevel,
  confirmText,
}: {
  continueOperate: boolean;
  setContinueOperate: (checked: ICheckedState) => void;
  showContinueOperateCheckbox?: boolean;
  onConfirm: IFooterActionsProps['onConfirm'];
  onCancel: IFooterActionsProps['onCancel'];
  confirmButtonProps?: IFooterActionsProps['confirmButtonProps'];
  riskLevel: EHostSecurityLevel;
  confirmText?: string;
}) {
  const intl = useIntl();
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
      onConfirmText={
        confirmText ?? intl.formatMessage({ id: ETranslations.global_approve })
      }
      confirmButtonProps={{
        variant:
          riskLevel === EHostSecurityLevel.High ? 'destructive' : 'primary',
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
        flexDirection:
          riskLevel === EHostSecurityLevel.High ? 'row-reverse' : 'row',
      }}
    >
      {showContinueOperateCheckbox ? (
        <Checkbox
          label="Proceed at my own risk"
          value={continueOperate}
          onChange={setContinueOperate}
        />
      ) : null}
    </Page.FooterActions>
  );
}

export { DAppRequestFooter };
