import { IconButton, SizableText, Stack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { ITestAccount } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';

interface ITestAccountListItemProps {
  account: ITestAccount;
  onEdit: (account: ITestAccount) => void;
  onDelete: (id: string, name: string) => void;
}

export function TestAccountListItem({
  account,
  onEdit,
  onDelete,
}: ITestAccountListItemProps) {
  return (
    <ListItem
      px="$1"
      title={account.name || account.email}
      subtitle={
        <Stack gap="$0.5">
          <SizableText size="$bodyMd" color="$textSubdued">
            {account.email}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            OTP: {account.otp}
          </SizableText>
        </Stack>
      }
    >
      <Stack flexDirection="row" alignItems="center" gap="$3">
        <IconButton
          icon="PencilOutline"
          variant="tertiary"
          size="small"
          onPress={() => onEdit(account)}
        />
        <IconButton
          icon="DeleteOutline"
          variant="tertiary"
          size="small"
          onPress={() => onDelete(account.id, account.name || account.email)}
        />
      </Stack>
    </ListItem>
  );
}
