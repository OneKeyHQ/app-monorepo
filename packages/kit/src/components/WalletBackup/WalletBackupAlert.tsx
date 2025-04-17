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
        flexDirection="row"
        $md={{
          flexDirection: 'column',
          gap: '$2',
          alignItems: 'flex-start',
        }}
      >
        <XStack
          gap="$2"
          alignItems="center"
          $md={{
            alignItems: 'flex-start',
          }}
        >
          <Stack w="$5" h="$5">
            <Icon
              size="$5"
              name="ShieldExclamationSolid"
              color="$iconCritical"
              $md={{
                mt: '$2',
              }}
            />
          </Stack>
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
            $md={{
              ml: '$5',
            }}
          >
            {intl.formatMessage({ id: ETranslations.backup_backup_now })}
          </Button>
        </WalletBackupActions>
      </Stack>
    );
  }

  return null;
}
