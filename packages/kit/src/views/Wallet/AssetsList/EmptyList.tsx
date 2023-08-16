import { memo, useCallback } from 'react';

import { LinearGradient } from 'expo-linear-gradient';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Empty,
  Icon,
  Typography,
} from '@onekeyhq/components';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import type { INetwork } from '@onekeyhq/engine/src/types';

import { LazyDisplayView } from '../../../components/LazyDisplayView';
import {
  useNavigation,
  useNavigationActions,
  useNetwork,
  useOverviewAccountUpdateInfo,
  useOverviewLoading,
} from '../../../hooks';
import { useActionForAllNetworks } from '../../../hooks/useAllNetwoks';
import {
  FiatPayModalRoutes,
  ManageTokenModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../routes/routesEnum';

import {
  atomTokenAssetsListLoading,
  useAtomAssetsList,
} from './contextAssetsList';
import AssetsListSkeleton from './Skeleton';
import SvgAllNetwrorksLoadingLight from './Svg/SvgAllNetworksLoadingDark';

export const AllNetworksEmpty = () => {
  const intl = useIntl();

  const { openAccountSelector } = useNavigationActions();
  return (
    <Empty
      emoji="🥺"
      title={intl.formatMessage({ id: 'empty__no_included_network' })}
      subTitle={intl.formatMessage({
        id: 'empty__no_included_network_desc',
      })}
      actionTitle={intl.formatMessage({ id: 'action__switch_account' })}
      handleAction={() => {
        openAccountSelector({});
      }}
      mt={8}
    />
  );
};

function EmptyListOfAccount({
  network,
  accountId,
}: {
  network: INetwork | null | undefined;
  accountId: string;
}) {
  const intl = useIntl();
  const navigation = useNavigation();

  const { visible, process: onBuy } = useActionForAllNetworks({
    accountId,
    networkId: network?.id ?? '',
    action: useCallback(
      ({ network: n, account: a }) => {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.FiatPay,
          params: {
            screen: FiatPayModalRoutes.SupportTokenListModal,
            params: {
              networkId: n.id,
              accountId: a.id,
            },
          },
        });
      },
      [navigation],
    ),
    filter: (p) => !!p.network && !!p.account,
  });

  return (
    <Box flexDirection="row" justifyContent="space-between">
      {visible ? (
        <Button flex={1} alignItems="flex-start" onPress={onBuy}>
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
      ) : null}

      {network?.settings?.tokenEnabled && !isAllNetworks(network?.id) ? (
        <Button
          ml="16px"
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
      ) : null}
    </Box>
  );
}

function AccountAssetsEmptyListView({
  networkId,
  accountId,
  showSkeletonHeader,
}: {
  networkId: string;
  accountId: string;
  showSkeletonHeader?: boolean;
}) {
  const intl = useIntl();
  const loading = useOverviewLoading({
    networkId,
    accountId,
  });
  const [isLoading] = useAtomAssetsList(atomTokenAssetsListLoading);
  const updateInfo = useOverviewAccountUpdateInfo({
    networkId: networkId ?? '',
    accountId: accountId ?? '',
  });
  const { network } = useNetwork({ networkId });
  if (loading || isLoading) {
    if (isAllNetworks(network?.id) && !updateInfo?.updatedAt) {
      return (
        <Box alignItems="center" mt="8">
          <Empty
            w="260px"
            icon={
              <Box mb="6">
                <SvgAllNetwrorksLoadingLight />
              </Box>
            }
            title={intl.formatMessage({ id: 'empty__creating_data' })}
            subTitle={intl.formatMessage({
              id: 'empty__creating_data_desc',
            })}
          />
        </Box>
      );
    }
    return <AssetsListSkeleton showSkeletonHeader={showSkeletonHeader} />;
  }
  if (isAllNetworks(network?.id)) {
    return <AllNetworksEmpty />;
  }
  return (
    <LazyDisplayView
      delay={0}
      defaultView={
        <AssetsListSkeleton showSkeletonHeader={showSkeletonHeader} />
      }
    >
      <EmptyListOfAccount network={network} accountId={accountId} />
    </LazyDisplayView>
  );
}
export const AccountAssetsEmptyList = memo(AccountAssetsEmptyListView);
export { EmptyListOfAccount };
