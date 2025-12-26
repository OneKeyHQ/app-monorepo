import { useMemo } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import type { IYStackProps } from '@onekeyhq/components';
import {
  IconButton,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import AddressTypeSelector from '@onekeyhq/kit/src/components/AddressTypeSelector/AddressTypeSelector';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import {
  useAccountSelectorActions,
  useAccountSelectorContextDataAtom,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { showWalletAvatarEditDialog } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/WalletAvatarEdit';
import { WalletEditButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/WalletEdit/WalletEditButton';
import { WalletRenameButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/WalletRename';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import type { IWalletDetailsProps } from '..';

type IWalletDetailsHeaderProps = {
  editable?: boolean;
  linkedNetworkId?: string;
} & IListItemProps &
  Partial<IWalletDetailsProps>;

export function WalletDetailsHeader({
  wallet,
  device,
  editable,
  linkedNetworkId,
  num,
  title,
  titleProps,
  ...rest
}: IWalletDetailsHeaderProps) {
  const [accountSelectorContextData] = useAccountSelectorContextDataAtom();
  const { selectedAccount } = useSelectedAccount({ num: num ?? 0 });
  const actions = useAccountSelectorActions();
  const intl = useIntl();

  const showAboutDevice =
    accountUtils.isHwWallet({ walletId: wallet?.id }) &&
    !accountUtils.isHwHiddenWallet({ wallet });
  const showRemoveButton = wallet?.id
    ? !accountUtils.isOthersWallet({
        walletId: wallet?.id,
      })
    : false;
  const isBackupRequired = useMemo(
    () => wallet?.type === WALLET_TYPE_HD && !wallet.backuped,
    [wallet],
  );
  const isAvatarEditable = useMemo(
    () => accountUtils.isHdWallet({ walletId: wallet?.id }) && editable,
    [wallet, editable],
  );

  const firmwareType = useMemo(() => {
    return wallet?.firmwareTypeAtCreated;
  }, [wallet?.firmwareTypeAtCreated]);

  return (
    <YStack
      testID="account-selector-header"
      py="$1"
      {...(rest as IYStackProps)}
    >
      <ListItem gap="$1.5">
        <XStack gap="$1.5" alignItems="center" flex={1}>
          <Stack
            borderRadius="$2"
            p="$1"
            m="$-1"
            {...(isAvatarEditable && {
              role: 'button',
              onPress: () =>
                wallet ? showWalletAvatarEditDialog({ wallet }) : null,
              hoverStyle: {
                bg: '$bgHover',
              },
              pressStyle: {
                bg: '$bgActive',
              },
              focusable: true,
              focusVisibleStyle: {
                outlineOffset: 2,
                outlineWidth: 2,
                outlineColor: '$focusRing',
                outlineStyle: 'solid',
              },
            })}
          >
            <Stack>
              <WalletAvatar
                size="$8"
                wallet={wallet}
                firmwareTypeBadge={firmwareType}
              />
              {isAvatarEditable ? (
                <ListItem.Avatar.CornerIcon
                  name="MenuCircleHorSolid"
                  color="$iconSubdued"
                />
              ) : null}
            </Stack>
          </Stack>
          {platformEnv.isWebDappMode ? (
            <SizableText size="$bodyLgMedium" pr="$1.5" numberOfLines={1}>
              {intl.formatMessage({
                id: ETranslations.global_connected_wallet,
              })}
            </SizableText>
          ) : null}
          {!platformEnv.isWebDappMode && wallet ? (
            <WalletRenameButton wallet={wallet} editable={editable} mr="$1.5" />
          ) : null}
        </XStack>

        {/* more edit button */}
        {editable ? <WalletEditButton num={num} wallet={wallet} /> : null}

        {/* single chain deriveType selector */}
        {linkedNetworkId &&
        !isNil(num) &&
        [
          EAccountSelectorSceneName.discover,
          EAccountSelectorSceneName.addressInput,
        ].includes(accountSelectorContextData?.sceneName as any) ? (
          <AddressTypeSelector
            placement="bottom-end"
            walletId={wallet?.id ?? ''}
            networkId={linkedNetworkId}
            indexedAccountId={
              selectedAccount.indexedAccountId ??
              accountUtils.buildIndexedAccountId({
                walletId: wallet?.id ?? '',
                index: 0,
              })
            }
            renderSelectorTrigger={
              <IconButton
                onPress={() => {}}
                icon="BranchesOutline"
                variant="tertiary"
              />
            }
            onSelect={async ({ deriveType }) => {
              await actions.current.updateSelectedAccountDeriveType({
                num,
                deriveType,
              });
            }}
          />
        ) : null}
      </ListItem>
    </YStack>
  );
}
