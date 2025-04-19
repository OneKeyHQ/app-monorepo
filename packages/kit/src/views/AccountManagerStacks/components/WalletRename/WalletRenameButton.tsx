import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Badge, Icon, SizableText, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { showRenameDialog } from '@onekeyhq/kit/src/components/RenameDialog';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { showLabelSetDialog as showHardwareLabelSetDialog } from './HardwareLabelSetDialog';

import type { CompositeNavigationProp } from '@react-navigation/native';

export function WalletRenameButton({ wallet }: { wallet: IDBWallet }) {
  const { serviceAccount } = backgroundApiProxy;
  const navigation = useNavigation<CompositeNavigationProp<any, any>>();
  const intl = useIntl();

  return (
    <XStack
      flex={1}
      py="$1"
      px="$1.5"
      alignItems="center"
      userSelect="none"
      borderRadius="$2"
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
      focusable
      focusVisibleStyle={{
        outlineOffset: 2,
        outlineWidth: 2,
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
      }}
      onPress={async () => {
        if (
          wallet &&
          wallet?.id &&
          accountUtils.isHwWallet({ walletId: wallet?.id }) &&
          !accountUtils.isHwHiddenWallet({
            wallet,
          })
        ) {
          showHardwareLabelSetDialog(
            {
              wallet,
            },
            {
              onSubmit: async (name) => {
                await backgroundApiProxy.serviceHardware.setDeviceLabel({
                  walletId: wallet?.id || '',
                  label: name,
                });
              },
            },
          );
        } else {
          showRenameDialog(wallet.name, {
            nameHistoryInfo: {
              entityId: wallet.id,
              entityType: EChangeHistoryEntityType.Wallet,
              contentType: EChangeHistoryContentType.Name,
            },
            disabledMaxLengthLabel: true,
            onSubmit: async (name) => {
              if (wallet?.id && name) {
                await serviceAccount.setWalletNameAndAvatar({
                  walletId: wallet?.id,
                  name,
                  shouldCheckDuplicate: true,
                });
              }
            },
          });
        }
      }}
    >
      <SizableText size="$bodyLgMedium" pr="$1.5" numberOfLines={1}>
        {wallet?.name}
      </SizableText>
      <Icon flexShrink={0} name="PencilSolid" size="$4" color="$iconSubdued" />
      {wallet.type === WALLET_TYPE_HD && !wallet.backuped ? (
        <Badge badgeSize="sm" badgeType="critical" ml="$1">
          <Badge.Text>
            {intl.formatMessage({
              id: ETranslations.wallet_backup_status_not_backed_up,
            })}
          </Badge.Text>
        </Badge>
      ) : null}
    </XStack>
  );
}
