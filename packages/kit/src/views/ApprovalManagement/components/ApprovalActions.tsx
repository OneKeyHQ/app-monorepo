import { memo } from 'react';

import { useIntl } from 'react-intl';

import type { ICheckedState } from '@onekeyhq/components';
import { Checkbox, Page, Stack, useSafeAreaInsets } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type IProps = {
  isSelectMode?: boolean;
  isBulkRevokeMode?: boolean;
  isSelectAll: ICheckedState;
  setIsSelectAll: (checked: ICheckedState) => void;
  onConfirm: () => void;
  onCancel: () => void;
  selectedCount: number;
  onCancelText?: string;
  isBuildingRevokeTxs: boolean;
};

function ApprovalActions(props: IProps) {
  const {
    isSelectMode,
    isBulkRevokeMode,
    isSelectAll,
    setIsSelectAll,
    onConfirm,
    onCancel,
    onCancelText,
    selectedCount,
    isBuildingRevokeTxs,
  } = props;

  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();

  return (
    <Page.Footer disableKeyboardAnimation>
      <Page.FooterActions
        confirmButtonProps={{
          disabled:
            isBuildingRevokeTxs || (selectedCount === 0 && !isSelectMode),
          loading: isBuildingRevokeTxs,
          variant: 'primary',
        }}
        cancelButtonProps={{
          disabled: isBuildingRevokeTxs,
        }}
        onCancelText={onCancelText}
        onConfirmText={
          isBulkRevokeMode
            ? `${intl.formatMessage({
                id: ETranslations.global_revoke,
              })} (${selectedCount})`
            : intl.formatMessage({ id: ETranslations.global_apply })
        }
        onConfirm={onConfirm}
        onCancel={onCancel}
        $gtMd={{
          flexDirection: 'row',
          alignItems: 'flex-end',
        }}
        {...(bottom && {
          mb: bottom,
        })}
      >
        <Stack
          gap="$2.5"
          pb="$5"
          $gtMd={{
            pb: '$0',
          }}
        >
          <Checkbox
            label={intl.formatMessage({
              id: ETranslations.global_select_all,
            })}
            value={isSelectAll}
            onChange={(checked) => {
              setIsSelectAll(checked);
            }}
          />
        </Stack>
      </Page.FooterActions>
    </Page.Footer>
  );
}

export default memo(ApprovalActions);
