import { useMemo } from 'react';

import { isNil } from 'lodash';

import { Stack, XStack, YStack } from '@onekeyhq/components';
import { DeriveTypeSelectorTriggerForDapp } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import {
  useAccountSelectorContextDataAtom,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { showWalletAvatarEditDialog } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/WalletAvatarEdit';
import { WalletEditButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/WalletEdit/WalletEditButton';
import { WalletRenameButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/WalletRename';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import type { IWalletDetailsProps } from '..';

type IWalletDetailsHeaderProps = {
  editable?: boolean;
  editMode: boolean;
  linkedNetworkId?: string;
} & IListItemProps &
  Partial<IWalletDetailsProps>;

export function WalletDetailsHeader({
  wallet,
  device,
  editable,
  editMode,
  linkedNetworkId,
  num,
  title,
  titleProps,
  ...rest
}: IWalletDetailsHeaderProps) {
  const [accountSelectorContextData] = useAccountSelectorContextDataAtom();
  const { selectedAccount } = useSelectedAccount({ num: num ?? 0 });

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

  return (
    <YStack testID="account-selector-header" py="$1" {...rest}>
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
              <WalletAvatar size="$8" wallet={wallet} />
              {isAvatarEditable ? (
                <ListItem.Avatar.CornerIcon
                  name="MenuCircleHorSolid"
                  color="$iconSubdued"
                />
              ) : null}
            </Stack>
          </Stack>
          {wallet ? (
            <WalletRenameButton wallet={wallet} editable={editable} />
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
          <DeriveTypeSelectorTriggerForDapp
            num={num}
            focusedWalletId={
              !isNil(num) ? selectedAccount.focusedWallet : undefined
            }
          />
        ) : null}
      </ListItem>
    </YStack>
  );
}
