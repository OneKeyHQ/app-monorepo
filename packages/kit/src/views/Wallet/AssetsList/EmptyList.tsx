import { FC } from 'react';

import { LinearGradient } from 'expo-linear-gradient';
import { useIntl } from 'react-intl';

import { Box, Button, Center, Icon, Typography } from '@onekeyhq/components';

import { useActiveWalletAccount, useNavigation } from '../../../hooks';
import { FiatPayRoutes } from '../../../routes/Modal/FiatPay';
import { ManageTokenRoutes } from '../../../routes/Modal/ManageToken';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';

const EmptyList: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { network } = useActiveWalletAccount();

  return (
    <Box flexDirection="row" justifyContent="space-between">
      <Button
        borderWidth={0}
        bg="surface-default"
        flex={1}
        mr="16px"
        onPress={() => {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.FiatPay,
            params: {
              screen: FiatPayRoutes.SupportTokenListModal,
              params: {
                networkId: network?.id ?? '',
              },
            },
          });
        }}
      >
        <Box py="32px" flexDirection="column" alignItems="center">
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
              <Icon name="NavBuySolid" color="icon-on-primary" />
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
        borderWidth={0}
        bg="surface-default"
        flex={1}
        onPress={() => {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.ManageToken,
            params: { screen: ManageTokenRoutes.Listing },
          });
        }}
      >
        <Box py="32px" flexDirection="column" alignItems="center">
          <Center
            w="48px"
            h="48px"
            borderRadius="24px"
            bg="surface-neutral-default"
            mb="24px"
          >
            <Icon name="ViewGridAddSolid" />
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
};

export default EmptyList;
