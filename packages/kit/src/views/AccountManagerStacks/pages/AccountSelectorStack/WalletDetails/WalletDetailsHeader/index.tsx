import { isNil } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Button, XStack } from '@onekeyhq/components';
import { DeriveTypeSelectorTriggerForDapp } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  useAccountSelectorContextDataAtom,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { WalletRemoveButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/WalletRemove';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AboutDevice } from './AboutDevice';

import type { IWalletDetailsProps } from '..';

type IWalletDetailsHeaderProps = {
  editable?: boolean;
  editMode: boolean;
  linkedNetworkId?: string;
  onEditButtonPress?: () => void;
} & IListItemProps &
  Partial<IWalletDetailsProps>;

export function WalletDetailsHeader({
  wallet,
  device,
  editable,
  editMode,
  onEditButtonPress,
  linkedNetworkId,
  num,
  ...rest
}: IWalletDetailsHeaderProps) {
  const [accountSelectorContextData] = useAccountSelectorContextDataAtom();
  const intl = useIntl();
  const showAboutDevice =
    accountUtils.isHwWallet({ walletId: wallet?.id }) &&
    !accountUtils.isHwHiddenWallet({ wallet });
  const showRemoveButton = wallet?.id
    ? !accountUtils.isOthersWallet({
        walletId: wallet?.id,
      })
    : false;
  const { selectedAccount } = useSelectedAccount({ num: num ?? 0 });

  return (
    <ListItem
      testID="account-selector-header"
      mt="$1.5"
      justifyContent="flex-end"
      {...rest}
    >
      {editMode && editable ? (
        <XStack
          pr="$5"
          mr="$2"
          gap="$5"
          borderRightWidth={StyleSheet.hairlineWidth}
          borderRightColor="$borderSubdued"
        >
          {showAboutDevice ? <AboutDevice device={device} /> : null}
          {showRemoveButton ? <WalletRemoveButton wallet={wallet} /> : null}
        </XStack>
      ) : null}
      {editable ? (
        <Button
          testID="account-edit-button"
          variant="tertiary"
          alignSelf="flex-start"
          $gtMd={{ top: '$0.5' }}
          onPress={onEditButtonPress}
          {...(editMode && {
            color: '$textInteractive',
            icon: 'CheckLargeOutline',
            iconColor: '$iconSuccess',
          })}
        >
          {editMode
            ? intl.formatMessage({ id: ETranslations.global_done })
            : intl.formatMessage({ id: ETranslations.global_edit })}
        </Button>
      ) : null}
      {linkedNetworkId &&
      !isNil(num) &&
      accountSelectorContextData?.sceneName ===
        EAccountSelectorSceneName.discover ? (
        <DeriveTypeSelectorTriggerForDapp
          num={num}
          focusedWalletId={
            !isNil(num) ? selectedAccount.focusedWallet : undefined
          }
        />
      ) : null}
    </ListItem>
  );
}
