import { useIntl } from 'react-intl';

import { Badge, Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import { WalletRenameButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/WalletRename';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';

function DeviceBasicInfoSection({ data }: { data: IHwQrWalletWithDevice }) {
  const { wallet, device } = data;
  const intl = useIntl();
  return (
    <YStack pt="$3" pb="$3" gap="$1.5" bg="$bgSubdued" borderRadius="$4">
      <XStack pt={9} flex={1} ai="center">
        <XStack h={50} w={80} ai="center" jc="center">
          <WalletAvatar
            size={50}
            wallet={wallet}
            status="default"
            badge={
              accountUtils.isQrWallet({ walletId: wallet.id })
                ? 'QR'
                : undefined
            }
          />
        </XStack>
        <YStack flex={1}>
          <XStack ml={-5} h="$6">
            <WalletRenameButton wallet={wallet} />
          </XStack>
          <XStack mt="$1.5" gap="$1.5">
            <Badge badgeSize="sm" badgeType="default">
              v2.2.1
            </Badge>
            <Badge badgeSize="sm" badgeType="success">
              <XStack ai="center" gap="$1.5">
                <Icon
                  name="BadgeVerifiedSolid"
                  color="$iconSuccess"
                  size="$4"
                />
                <SizableText size="$bodySmMedium" color="$iconSuccess">
                  {intl.formatMessage({
                    id: ETranslations.global_verified,
                  })}
                </SizableText>
              </XStack>
            </Badge>
          </XStack>
        </YStack>
      </XStack>
      <YStack>
        <ListItem
          title={intl.formatMessage({
            id: ETranslations.global_homescreen,
          })}
          drillIn
          onPress={() => {
            console.log('onPress');
          }}
        />
        <ListItem
          title={intl.formatMessage({
            id: ETranslations.device_auth_request_title,
          })}
          drillIn
          onPress={() => {
            console.log('onPress');
          }}
        />
        <ListItem
          title={intl.formatMessage({
            id: ETranslations.global_check_for_updates,
          })}
          drillIn
          onPress={() => {
            console.log('onPress');
          }}
        />
      </YStack>
    </YStack>
  );
}

export default DeviceBasicInfoSection;
