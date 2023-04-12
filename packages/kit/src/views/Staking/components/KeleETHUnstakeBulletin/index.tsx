import { useCallback, useMemo } from 'react';
import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Box } from '@onekeyhq/components';
import type { Token } from '@onekeyhq/engine/src/types/token';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useAppSelector,
  useNavigation,
} from '../../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../../routes/types';
import { setHideUnstakeBulletin } from '../../../../store/reducers/staking';
import { useKeleMinerOverview } from '../../hooks';
import { StakingRoutes } from '../../typing';

type KeleETHUnstakeBulletinProps = {
  token?: Token;
};

export const KeleETHUnstakeBulletin: FC<KeleETHUnstakeBulletinProps> = ({
  token,
}) => {
  const intl = useIntl();
  const { accountId } = useActiveWalletAccount();
  const networkId = token?.networkId;
  const navigation = useNavigation();
  const keleMinerOverview = useKeleMinerOverview(networkId, accountId);
  const enableETH2Unstake = useAppSelector((s) => s.settings.enableETH2Unstake);
  const hideUnstakeBulletin = useAppSelector(
    (s) => s.staking.hideUnstakeBulletin,
  );

  const onUnstake = useCallback(() => {
    backgroundApiProxy.dispatch(setHideUnstakeBulletin(true));
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Staking,
      params: {
        screen: StakingRoutes.StakedETHOnKele,
        params: {
          networkId: networkId ?? '',
        },
      },
    });
  }, [navigation, networkId]);

  const show = useMemo(() => {
    const networkIds = [OnekeyNetwork.eth, OnekeyNetwork.goerli] as string[];
    const retailStaked = keleMinerOverview?.amount.retail_staked ?? 0;
    return (
      !hideUnstakeBulletin &&
      enableETH2Unstake &&
      !token?.tokenIdOnNetwork &&
      networkId &&
      networkIds.includes(networkId) &&
      Number(retailStaked) > 0
    );
  }, [
    token,
    keleMinerOverview,
    networkId,
    enableETH2Unstake,
    hideUnstakeBulletin,
  ]);

  const onDismiss = useCallback(() => {
    backgroundApiProxy.dispatch(setHideUnstakeBulletin(true));
  }, []);

  return show ? (
    <Box mb="8">
      <Alert
        alertType="info"
        action={intl.formatMessage({ id: 'action__view' })}
        onAction={onUnstake}
        onDismiss={onDismiss}
        title={intl.formatMessage({
          id: 'msg__eth_20_unstaking_is_now_available',
        })}
      />
    </Box>
  ) : null;
};
