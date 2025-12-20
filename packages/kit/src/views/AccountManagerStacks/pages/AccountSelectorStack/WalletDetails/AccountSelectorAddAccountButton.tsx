import { useIntl } from 'react-intl';

import { Icon, Stack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type {
  IDBDevice,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useAddAccount } from './hooks/useAddAccount';

export function AccountSelectorAddAccountButton({
  num,
  isOthersUniversal,
  focusedWalletInfo,
}: {
  num: number;
  isOthersUniversal: boolean;
  focusedWalletInfo:
    | {
        wallet: IDBWallet;
        device: IDBDevice | undefined;
      }
    | undefined;
}) {
  const intl = useIntl();
  const { handleAddAccount } = useAddAccount({
    num,
    isOthersUniversal,
    focusedWalletInfo,
  });

  return (
    <ListItem testID="account-add-account" onPress={handleAddAccount}>
      <Stack bg="$bgStrong" borderRadius="$2" p="$1" borderCurve="continuous">
        <Icon name="PlusSmallOutline" />
      </Stack>
      {/* Add account */}
      <ListItem.Text
        userSelect="none"
        primary={intl.formatMessage({
          id: platformEnv.isWebDappMode
            ? ETranslations.onboarding_connect_external_wallet
            : ETranslations.global_account,
        })}
        primaryTextProps={{
          color: '$textSubdued',
        }}
      />
    </ListItem>
  );
}
