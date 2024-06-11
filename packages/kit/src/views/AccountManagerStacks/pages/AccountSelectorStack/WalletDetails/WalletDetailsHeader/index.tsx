import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Button, XStack } from '@onekeyhq/components';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { WalletRemoveButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/WalletRemove';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { AboutDevice } from './AboutDevice';

import type { IWalletDetailsProps } from '..';

type IWalletDetailsHeaderProps = {
  editable?: boolean;
  editMode: boolean;
  onEditButtonPress?: () => void;
} & IListItemProps &
  Partial<IWalletDetailsProps>;

export function WalletDetailsHeader({
  wallet,
  device,
  editable,
  editMode,
  onEditButtonPress,
  ...rest
}: IWalletDetailsHeaderProps) {
  const intl = useIntl();
  const showAboutDevice =
    accountUtils.isHwWallet({ walletId: wallet?.id }) &&
    !accountUtils.isHwHiddenWallet({ wallet });
  const showRemoveButton = wallet?.id
    ? !accountUtils.isOthersWallet({
        walletId: wallet?.id,
      })
    : false;
  return (
    <ListItem
      id="account-selector-header"
      mt="$1.5"
      justifyContent="flex-end"
      {...rest}
    >
      {editMode && editable ? (
        <XStack
          pr="$5"
          mr="$2"
          space="$5"
          borderRightWidth={StyleSheet.hairlineWidth}
          borderRightColor="$borderSubdued"
        >
          {showAboutDevice ? <AboutDevice device={device} /> : null}
          {showRemoveButton ? <WalletRemoveButton wallet={wallet} /> : null}
        </XStack>
      ) : null}
      {editable ? (
        <Button
          testID="AccountSelectorModal-EditButton"
          variant="tertiary"
          onPress={onEditButtonPress}
        >
          {editMode
            ? intl.formatMessage({ id: ETranslations.global_done })
            : intl.formatMessage({ id: ETranslations.global_edit })}
        </Button>
      ) : null}
    </ListItem>
  );
}
