import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  Modal,
  Pressable,
  Token,
  Typography,
} from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';
import { useManageNetworks } from '@onekeyhq/kit/src/hooks';
import { useRuntime } from '@onekeyhq/kit/src/hooks/redux';
import type { CreateAccountRoutesParams } from '@onekeyhq/kit/src/routes';
import { CreateAccountModalRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import type { RouteProp } from '@react-navigation/native';
import type { ListRenderItem } from 'react-native';

type NavigationProps = ModalScreenProps<CreateAccountRoutesParams>;

type RouteProps = RouteProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.RecoverySelectChainList
>;

const ItemSeparatorComponent = () => <Box h="8px" />;

const RecoverSelectChainModal: FC = () => {
  const intl = useIntl();

  const route = useRoute<RouteProps>();
  const { wallets } = useRuntime();
  const { enabledNetworks: networks } = useManageNetworks();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const { walletId: selectedWalletId } = route.params;

  const wallet = useMemo(
    () => wallets.find((w) => w.id === selectedWalletId),
    [selectedWalletId, wallets],
  );

  const selectableNetworks = useMemo(
    () =>
      networks.filter((network) => {
        if (wallet?.type === 'hw') {
          return network.settings.hardwareAccountEnabled;
        }
        if (wallet?.type === 'imported') {
          return network.settings.importedAccountEnabled;
        }
        if (wallet?.type === 'watching') {
          return network.settings.watchingAccountEnabled;
        }
        return true;
      }),
    [networks, wallet],
  );

  function getPurpose(network: Network) {
    const { category } = network.accountNameInfo.default;
    const purpose = parseInt(category.split("'/")[0]);
    return purpose;
  }

  function getTemplate(network: Network) {
    const { template } = network.accountNameInfo.default;
    return template;
  }

  const onSelectChain = useCallback(
    (network: Network) => {
      navigation.navigate(
        CreateAccountModalRoutes.CreateAccountAuthentication,
        {
          walletId: selectedWalletId,
          onDone: (password) => {
            const purpose = getPurpose(network);
            const template = getTemplate(network);
            navigation.replace(CreateAccountModalRoutes.RecoverAccountsList, {
              purpose,
              walletId: selectedWalletId,
              network: network.id,
              password,
              template,
            });
          },
        },
      );
    },
    [navigation, selectedWalletId],
  );

  const renderItem: ListRenderItem<Network> = useCallback(
    ({ item }) => (
      <Pressable
        height="56px"
        alignItems="center"
        flexDirection="row"
        borderRadius="12px"
        paddingX="16px"
        _pressed={{ bg: 'surface-pressed' }}
        _hover={{ bg: 'surface-hovered' }}
        onPress={() => {
          onSelectChain(item);
        }}
      >
        <Token
          size="32px"
          token={{ logoURI: item.logoURI, name: item.shortName }}
        />
        <Typography.Body1Strong ml="16px" mr="12px">
          {item.shortName}
        </Typography.Body1Strong>
        {item.impl === 'evm' ? (
          <Badge title="EVM" size="sm" type="default" />
        ) : null}
      </Pressable>
    ),
    [onSelectChain],
  );

  return (
    <Modal
      height="640px"
      header={intl.formatMessage({ id: 'modal__select_chain' })}
      footer={null}
      flatListProps={{
        style: { paddingLeft: 0, paddingRight: 0 },
        data: selectableNetworks,
        // @ts-ignore
        renderItem,
        ItemSeparatorComponent,
        keyExtractor: (item) => (item as Network).id,
        showsVerticalScrollIndicator: false,
      }}
    />
  );
};

export default RecoverSelectChainModal;
