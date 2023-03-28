import { LinearGradient } from 'expo-linear-gradient';
import { useIntl } from 'react-intl';

import { Box, Button, Center, Icon, Typography } from '@onekeyhq/components';
import type { INetwork } from '@onekeyhq/engine/src/types';

import { useActiveWalletAccount, useNavigation } from '../../../hooks';
import {
  FiatPayModalRoutes,
  ManageTokenModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../routes/routesEnum';

function EmptyListOfAccount({
  network,
  accountId,
}: {
  network: INetwork | null | undefined;
  accountId: string;
}) {
  const intl = useIntl();
  const navigation = useNavigation();

  return (
    <Box flexDirection="row" justifyContent="space-between">
      <Button
        flex={1}
        mr="16px"
        alignItems="flex-start"
        onPress={() => {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.FiatPay,
            params: {
              screen: FiatPayModalRoutes.SupportTokenListModal,
              params: {
                networkId: network?.id ?? '',
                accountId,
              },
            },
          });
        }}
      >
        <Box py="24px" flexDirection="column" alignItems="center">
          <Box
            w="48px"
            h="48px"
            borderRadius="24px"
            bg="surface-neutral-default"
            mb="24px"
            overflow="hidden"
          >
            <LinearGradient
              colors={['#64D36F', '#33C641']}
              style={{
                width: '100%',
                height: '100%',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Icon name="PlusOutline" color="icon-on-primary" />
            </LinearGradient>
          </Box>
          <Typography.DisplayMedium mb="4px" textAlign="center">
            {intl.formatMessage({ id: 'action__buy_crypto' })}
          </Typography.DisplayMedium>
          <Typography.Body2 mb="4px" color="text-subdued" textAlign="center">
            {intl.formatMessage({ id: 'action__buy_crypto_desc' })}
          </Typography.Body2>
        </Box>
      </Button>

      <Button
        flex={1}
        alignItems="flex-start"
        onPress={() => {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.ManageToken,
            params: { screen: ManageTokenModalRoutes.Listing },
          });
        }}
      >
        <Box py="24px" flexDirection="column" alignItems="center">
          <Center
            w="48px"
            h="48px"
            borderRadius="24px"
            bg="surface-neutral-default"
            mb="24px"
          >
            <Icon name="ViewGridAddMini" />
          </Center>
          <Typography.DisplayMedium mb="4px" textAlign="center">
            {intl.formatMessage({ id: 'action__add_tokens' })}
          </Typography.DisplayMedium>
          <Typography.Body2 mb="4px" color="text-subdued" textAlign="center">
            {intl.formatMessage({ id: 'action__add_tokens_desc' })}
          </Typography.Body2>
        </Box>
      </Button>
    </Box>
  );
}

function EmptyList() {
  const { network, accountId } = useActiveWalletAccount();

  return <EmptyListOfAccount network={network} accountId={accountId} />;
}

export { EmptyListOfAccount };
export default EmptyList;
