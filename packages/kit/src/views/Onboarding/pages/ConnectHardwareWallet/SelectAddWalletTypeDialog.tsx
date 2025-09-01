import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function SelectAddWalletTypeDialogContent({
  onAddStandardWalletPress,
  onAddHiddenWalletPress,
}: {
  onAddStandardWalletPress: () => void;
  onAddHiddenWalletPress: () => void;
}) {
  const intl = useIntl();

  return (
    <YStack>
      <Dialog.Header>
        <Dialog.Title>
          {intl.formatMessage({
            id: ETranslations.global_select_wallet_type_to_add,
          })}
        </Dialog.Title>
      </Dialog.Header>
      <YStack gap="$4">
        <ListItem
          px="$4"
          mx="$0"
          py="$3"
          borderRadius="$2"
          borderCurve="continuous"
          borderWidth={1}
          borderColor="$borderSubdued"
          icon="WalletOutline"
          title={intl.formatMessage({
            id: ETranslations.global_standard_wallet,
          })}
          subtitle={intl.formatMessage({
            id: ETranslations.global_standard_wallet_desc,
          })}
          onPress={onAddStandardWalletPress}
        >
          <ListItem.DrillIn />
        </ListItem>

        <ListItem
          px="$4"
          mx="$0"
          py="$3"
          borderRadius="$2"
          borderCurve="continuous"
          borderWidth={1}
          borderColor="$borderSubdued"
          icon="LockOutline"
          iconProps={{
            alignSelf: 'flex-start',
          }}
          title={intl.formatMessage({
            id: ETranslations.global_hidden_wallet,
          })}
          subtitle={intl.formatMessage({
            id: ETranslations.global_hidden_wallet_desc,
          })}
          onPress={onAddHiddenWalletPress}
        >
          <ListItem.DrillIn />
        </ListItem>
      </YStack>
    </YStack>
  );
}

export function useSelectAddWalletTypeDialog() {
  const [isLoading, setIsLoading] = useState(false);

  // return promise
  const showSelectAddWalletTypeDialog = useCallback(async (): Promise<
    'Standard' | 'Hidden' | undefined
  > => {
    return new Promise((resolve) => {
      const onCloseFn = async () => {
        setIsLoading(false);
        resolve(undefined);
      };

      setIsLoading(true);

      const selectAddWalletTypeDialog = Dialog.show({
        tone: 'success',
        icon: 'DocumentSearch2Outline',
        title: ' ',
        description: ' ',
        dismissOnOverlayPress: false,
        showFooter: false,
        renderContent: (
          <SelectAddWalletTypeDialogContent
            onAddStandardWalletPress={() => {
              void selectAddWalletTypeDialog.close();
              resolve('Standard');
            }}
            onAddHiddenWalletPress={() => {
              void selectAddWalletTypeDialog.close();
              resolve('Hidden');
            }}
          />
        ),
        onCancel: onCloseFn,
        onClose: onCloseFn,
      });
    });
  }, []);
  return {
    showSelectAddWalletTypeDialog,
    isLoading,
  };
}
