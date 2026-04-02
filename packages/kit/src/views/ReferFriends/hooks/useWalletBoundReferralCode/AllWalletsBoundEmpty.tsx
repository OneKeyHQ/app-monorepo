import { useIntl } from 'react-intl';

import { Button, Dialog, Empty, YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EAccountManagerStacksRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

export function AllWalletsBoundEmpty() {
  const intl = useIntl();
  const navigation = useAppNavigation();

  return (
    <>
      <YStack flex={1} jc="center" ai="center" py="$10">
        <Empty
          icon="WalletOutline"
          title={intl.formatMessage({
            id: ETranslations.referral_apply_code_no_wallet,
          })}
          description={intl.formatMessage({
            id: ETranslations.referral_apply_code_all_bound,
          })}
        />
        <Button
          mt="$5"
          onPress={() => {
            navigation.pushModal(EModalRoutes.AccountManagerStacks, {
              screen: EAccountManagerStacksRoutes.AccountSelectorStack,
              params: {
                num: 0,
                sceneName: EAccountSelectorSceneName.home,
                sceneUrl: '',
                editable: true,
              },
            });
          }}
        >
          {intl.formatMessage({ id: ETranslations.global_create_wallet })}
        </Button>
      </YStack>
      <Dialog.Footer showConfirmButton={false} showCancelButton={false} />
    </>
  );
}
