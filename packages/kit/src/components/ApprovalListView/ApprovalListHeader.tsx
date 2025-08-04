import { memo } from 'react';

import { SizableText, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IAccountToken } from '@onekeyhq/shared/types/token';
import { useIntl } from 'react-intl';
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
          label={intl.formatMessage({ id: ETranslations.global_asset })}
        />
      </Stack>
      <Stack flexGrow={1} flexBasis={0} maxWidth="$36" alignItems="flex-end">
        <HeaderItem
          label={intl.formatMessage({ id: ETranslations.global_balance })}
        />
      </Stack>
      <Stack flexGrow={1} flexBasis={0} alignItems="flex-end">
        <HeaderItem
          label={intl.formatMessage({ id: ETranslations.global_price })}
        />
      </Stack>
      <Stack flexGrow={1} flexBasis={0} />
    </ListItem>
  );
}

export default memo(ApprovalListHeader);
