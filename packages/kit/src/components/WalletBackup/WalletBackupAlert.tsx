/* eslint-disable react/no-unstable-nested-components */

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
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
      <YStack
        testID="wallet_backup_backup_warning"
        position="absolute"
        left="$0"
        bottom="$0"
        zIndex="$5"
        w="100%"
        p="$4"
        $gtMd={{
          maxWidth: '$96',
        }}
      >
        <XStack
          gap="$2"
          px="$4"
          py="$3.5"
          bg="$bgSubdued"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
          borderRadius="$2"
          borderCurve="continuous"
          $platform-web={{
            borderWidth: 0,
            outlineWidth: 1,
            outlineColor: '$neutral3',
            outlineStyle: 'solid',
          }}
          elevation={5}
        >
          <Icon
            size="$5"
            flexShrink={0}
            name="ShieldExclamationSolid"
            color="$iconCritical"
          />
          <YStack flex={1} gap="$2">
            <SizableText size="$bodyMd">
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
      </YStack>
    );
  }

  return null;
}
