import { useEffect } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Modal, Spinner, ToastManager } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import Protected, { ValidationFields } from '../../../components/Protected';
import { useActiveWalletAccount, useNavigation } from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/types';
import { StakingRoutes } from '../typing';

import type { StakingRoutesParams } from '../typing';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<
  StakingRoutesParams,
  StakingRoutes.WithdrawProtected
>;

const WithdrawContent = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();

  const { params } = route;
  useEffect(() => {
    async function main() {
      const res = await backgroundApiProxy.serviceStaking.withdraw({
        accountId: params.accountId,
        networkId: params.networkId,
        amount: params.amount,
      });
      if (res.code !== 0 && res.message) {
        ToastManager.show({ title: res.message }, { type: 'error' });
      } else {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Staking,
          params: {
            screen: StakingRoutes.StakedETHOnKele,
            params: {
              networkId: params.networkId,
            },
          },
        });
        await backgroundApiProxy.serviceStaking.fetchPendingWithdrawAmount({
          accountId: params.accountId,
          networkId: params.networkId,
        });
        ToastManager.show({
          title: intl.formatMessage({ id: 'msg__success' }),
        });
      }
    }
    main();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Spinner />;
};

const WithdrawProtected = () => {
  const { walletId } = useActiveWalletAccount();
  return (
    <Modal footer={null}>
      <Protected walletId={walletId} field={ValidationFields.Payment}>
        {() => <WithdrawContent />}
      </Protected>
    </Modal>
  );
};

export default WithdrawProtected;
