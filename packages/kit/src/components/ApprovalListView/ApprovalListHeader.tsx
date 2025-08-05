import { memo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ListItem } from '../ListItem';

type IProps = {
  tableLayout?: boolean;
};

function HeaderItem({ label }: { label: string }) {
  return (
    <SizableText size="$bodyMdMedium" color="$textSubdued" userSelect="none">
      {label}
    </SizableText>
  );
}

function ApprovalListHeader({ tableLayout }: IProps) {
  const intl = useIntl();

  if (!tableLayout) {
    return null;
  }

  return (
    <ListItem testID="Wallet-Approval-List-Header">
      <Stack flexGrow={1} flexBasis={0} alignItems="flex-start">
        <HeaderItem
          label={intl.formatMessage({ id: ETranslations.global_contract })}
        />
      </Stack>
      <Stack flexGrow={1} flexBasis={0}>
        <HeaderItem
          label={intl.formatMessage({
            id: ETranslations.global_contract_address,
          })}
        />
      </Stack>
      <Stack flexGrow={1} flexBasis={0}>
        <HeaderItem
          label={intl.formatMessage({ id: ETranslations.global_approval_time })}
        />
      </Stack>
      <Stack flexGrow={1} flexBasis={0} alignItems="flex-end" maxWidth="$36">
        <HeaderItem
          label={intl.formatMessage({
            id: ETranslations.wallet_approval_approved_token,
          })}
        />
      </Stack>
    </ListItem>
  );
}

export default memo(ApprovalListHeader);
