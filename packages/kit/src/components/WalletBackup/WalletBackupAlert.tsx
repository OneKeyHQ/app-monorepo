/* eslint-disable react/no-unstable-nested-components */

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';

import { WalletBackupActions } from './WalletBackupActions';
import { StyleSheet } from 'react-native';

export function WalletBackupAlert() {
  const intl = useIntl();
  const {
    activeAccount: { wallet },
  } = useActiveAccount({
    num: 0,
  });

  if (wallet && wallet.type === WALLET_TYPE_HD && !wallet.backuped) {
    return (
      <XStack
        px="$5"
        py="$3.5"
        gap="$2"
        borderTopWidth={StyleSheet.hairlineWidth}
        borderBottomWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
      >
        <Icon size="$5" name="ShieldExclamationSolid" color="$iconCritical" />
        <YStack
          flex={1}
          gap="$2"
          $gtMd={{
            flexDirection: 'row',
          }}
        >
          <SizableText
            size="$bodyMd"
            $gtMd={{
              flex: 1,
            }}
          >
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
          <WalletBackupActions
            wallet={wallet}
            actionListProps={{
              offset: {
                crossAxis: -10,
              },
            }}
          >
            <Button
              size="small"
              variant="tertiary"
              iconAfter="ArrowRightOutline"
              onPress={() => {}}
              alignSelf="flex-start"
            >
              {intl.formatMessage({ id: ETranslations.backup_backup_now })}
            </Button>
          </WalletBackupActions>
        </YStack>
      </XStack>
    );
  }

  return null;
}
