import { StyleSheet } from 'react-native';

import { Button, XStack } from '@onekeyhq/components';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { WalletRemoveButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/WalletRemove';

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
  editable,
  editMode,
  onEditButtonPress,
  ...rest
}: IWalletDetailsHeaderProps) {
  return (
    <ListItem mt="$1.5" justifyContent="flex-end" {...rest}>
      {editMode && editable ? (
        <XStack
          pr="$5"
          mr="$2"
          space="$5"
          borderRightWidth={StyleSheet.hairlineWidth}
          borderRightColor="$borderSubdued"
        >
          <WalletRemoveButton wallet={wallet} />
          <AboutDevice />
        </XStack>
      ) : null}
      {editable ? (
        <Button
          testID="AccountSelectorModal-EditButton"
          variant="tertiary"
          onPress={onEditButtonPress}
        >
          {editMode ? 'Done' : 'Edit'}
        </Button>
      ) : null}
    </ListItem>
  );
}
