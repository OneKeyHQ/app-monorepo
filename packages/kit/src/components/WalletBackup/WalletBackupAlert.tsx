/* eslint-disable react/no-unstable-nested-components */

import { useIntl } from 'react-intl';

import { Button, Icon, SizableText, Stack, XStack } from '@onekeyhq/components';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';

import { WalletBackupActions } from './WalletBackupActions';

export function WalletBackupAlert() {
  const intl = useIntl();
  const {
    activeAccount: { wallet },
  } = useActiveAccount({
    num: 0,
  });

  if (wallet && wallet.type === WALLET_TYPE_HD && !wallet.backuped) {
    return (
      <Stack
        px="$5"
        py="$3.5"
        borderTopWidth={1}
        borderBottomWidth={1}
        borderColor="$borderSubdued"
        justifyContent="space-between"
        alignItems="center"
        flexDirection="column"
        $gtMd={{
          flexDirection: 'row',
        }}
      >
        <XStack gap="$2" alignItems="center">
          <Icon size="$5" name="ShieldExclamationSolid" color="$iconCritical" />
          <SizableText>
            {
              // @ts-ignore
              intl.formatMessage(
                {
                  id: ETranslations.wallet_backup_backup_warning,
                },
                {
                  strong: ([string]) => (
                    <SizableText size="$bodyMdMedium">{string}</SizableText>
                  ),
                },
              )
            }
          </SizableText>
        </XStack>
        <WalletBackupActions wallet={wallet}>
          <Button
            size="small"
            variant="tertiary"
            iconAfter="ArrowRightOutline"
            onPress={() => {}}
          >
            {intl.formatMessage({ id: ETranslations.backup_backup_now })}
          </Button>
        </WalletBackupActions>
      </Stack>
    );
  }

  return null;
}
