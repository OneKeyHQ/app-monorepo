import { useCallback, useMemo } from 'react';
import type { FC } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Image,
  Modal,
  Pressable,
  Typography,
} from '@onekeyhq/components';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  ModalRoutes,
  RootRoutes,
  SendModalRoutes,
} from '../../../routes/routesEnum';
import { addTransaction } from '../../../store/reducers/staking';
import { formatAmount } from '../../Swap/utils';
import { useLidoMaticOverview } from '../hooks';

import type {
  LidoMaticNFTStatus,
  StakingRoutes,
  StakingRoutesParams,
} from '../typing';
import type { RouteProp } from '@react-navigation/core';
import type { FlatListProps } from 'react-native';

type RouteProps = RouteProp<
  StakingRoutesParams,
  StakingRoutes.StakedMaticOnLido
>;

const ItemSeparatorComponent = () => <Box h="1" />;

type ClaimItemProps = {
  item: LidoMaticNFTStatus;
};
const ClaimItem: FC<ClaimItemProps> = ({ item }) => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const { networkId, accountId } = route.params;
  const onPress = useCallback(async () => {
    const claimTx =
      await backgroundApiProxy.serviceStaking.buildLidoMaticClaimWithdrawals({
        nftId: item.nftId,
        networkId,
      });
    const account = await backgroundApiProxy.engine.getAccount(
      accountId,
      networkId,
    );

    const encodedTx: IEncodedTxEvm = {
      ...claimTx,
      from: account.address,
    };
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Send,
      params: {
        screen: SendModalRoutes.SendConfirm,
        params: {
          accountId: account.id,
          networkId,
          feeInfoEditable: true,
          feeInfoUseFeeInTx: false,
          encodedTx,
          onSuccess(tx, data) {
            backgroundApiProxy.dispatch(
              addTransaction({
                accountId: account.id,
                networkId,
                transaction: {
                  hash: tx.txid,
                  accountId: account.id,
                  networkId,
                  type: 'lidoClaimMatic',
                  nonce: data?.decodedTx?.nonce,
                  addedTime: Date.now(),
                },
              }),
            );
            setTimeout(() => {
              navigation.goBack();
            }, 100);
          },
        },
      },
    });
  }, [item, networkId, accountId, navigation]);
  return (
    <Pressable onPress={onPress}>
      {({ isHovered, isPressed }) => {
        const getBgColor = () => {
          if (isPressed) {
            return 'surface-pressed';
          }
          if (isHovered) {
            return 'surface-hovered';
          }
        };
        return (
          <Box
            flexDirection="row"
            py="1"
            px="2"
            alignItems="center"
            borderRadius={12}
            bgColor={getBgColor()}
            justifyContent="space-between"
          >
            <Box flexDirection="row" alignItems="center">
              <Image
                borderRadius="full"
                overflow="hidden"
                mr="2"
                w="8"
                h="8"
                source={require('@onekeyhq/kit/assets/staking/matic_logo.png')}
              />
              <Typography.Body1Strong>
                {formatAmount(item.maticAmount, 6)} MATIC
              </Typography.Body1Strong>
            </Box>
            <Icon name="ChevronRightMini" size={20} />
          </Box>
        );
      }}
    </Pressable>
  );
};

const ListFooterComponent = () => {
  const intl = useIntl();
  return (
    <Box w="full" px="2" my="1">
      <Typography.Caption color="text-subdued">
        {intl.formatMessage({
          id: 'content__due_to_the_limitations_of_lido_you_must_claim_each_of_your_unstakes_separately',
        })}
      </Typography.Caption>
    </Box>
  );
};

const LidoMaticClaim = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { networkId, accountId } = route.params;
  const lidoMaticOverview = useLidoMaticOverview(networkId, accountId);
  const nfts = useMemo(() => {
    if (!lidoMaticOverview?.nfts) {
      return [];
    }
    return lidoMaticOverview.nfts.filter((o) => o.claimable);
  }, [lidoMaticOverview?.nfts]);

  const renderItem: FlatListProps<LidoMaticNFTStatus>['renderItem'] =
    useCallback(
      ({ item }: { item: LidoMaticNFTStatus }) => <ClaimItem item={item} />,
      [],
    );

  const keyExtractor: FlatListProps<LidoMaticNFTStatus>['keyExtractor'] =
    useCallback((item: LidoMaticNFTStatus) => String(item.nftId), []);

  return (
    <Modal
      footer={null}
      header={intl.formatMessage({ id: 'form__claim' })}
      flatListProps={{
        data: nfts,
        renderItem,
        keyExtractor,
        ItemSeparatorComponent,
        ListFooterComponent,
      }}
    />
  );
};

export default LidoMaticClaim;
