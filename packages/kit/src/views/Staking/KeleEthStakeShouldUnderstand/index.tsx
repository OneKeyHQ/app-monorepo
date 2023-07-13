import { useCallback } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Image,
  Modal,
  ToastManager,
  Typography,
} from '@onekeyhq/components';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ETHLogoPNG from '../../../../assets/staking/eth_staking.png';
import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNativeToken } from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { SendModalRoutes } from '../../Send/types';

import type { StakingRoutes, StakingRoutesParams } from '../typing';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<
  StakingRoutesParams,
  StakingRoutes.KeleEthStakeShouldUnderstand
>;

export default function StakingETHNotes() {
  const intl = useIntl();
  const navigation = useNavigation();
  const {
    params: { accountId, networkId, amount },
  } = useRoute<RouteProps>();
  const tokenInfo = useNativeToken(networkId);
  const onClose = useCallback(() => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) {
      parent.goBack();
    }
  }, [navigation]);
  const onSubmit = useCallback(async () => {
    const account = await backgroundApiProxy.engine.getAccount(
      accountId,
      networkId,
    );
    if (account && tokenInfo) {
      try {
        await backgroundApiProxy.serviceStaking.registerOnKele({
          payeeAddr: account.address,
          networkId,
        });
      } catch {
        debugLogger.common.error('registerOnKele failed');
      }

      const value = new BigNumber(amount)
        .shiftedBy(tokenInfo.decimals)
        .toFixed(0);
      let encodedTx: IEncodedTxEvm | undefined;
      try {
        const data =
          await backgroundApiProxy.serviceStaking.buildTxForStakingETHtoKele({
            value,
            networkId,
          });
        encodedTx = {
          ...data,
          from: account.address,
        };
      } catch (e) {
        ToastManager.show({ title: (e as Error).message }, { type: 'error' });
        return;
      }

      onClose();
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Send,
        params: {
          screen: SendModalRoutes.SendConfirm,
          params: {
            networkId,
            accountId,
            payloadInfo: {
              type: 'InternalStake',
              stakeInfo: {
                tokenInfo,
                amount,
                accountAddress: account.address,
              },
            },
            feeInfoEditable: true,
            feeInfoUseFeeInTx: false,
            encodedTx,
          },
        },
      });
    }
  }, [networkId, amount, accountId, navigation, tokenInfo, onClose]);
  return (
    <Modal
      hideSecondaryAction
      primaryActionTranslationId="action__confirm"
      primaryActionProps={{
        onPromise: onSubmit,
      }}
      scrollViewProps={{
        children: (
          <Box>
            <Center p="6">
              <Image w="24" h="24" source={ETHLogoPNG} />
              <Typography.DisplayLarge my="6">
                {intl.formatMessage({ id: 'title__eth_2_0_staking' })}
              </Typography.DisplayLarge>
            </Center>
            <Box>
              <Box flexDirection="row" mt="5">
                <Box flex="1">
                  <Typography.Body1Strong>
                    {intl.formatMessage({
                      id: 'content__in_the_rare_event_staked_eth_will_be_lost',
                    })}
                  </Typography.Body1Strong>
                  <Typography.Body2
                    color="text-subdued"
                    textBreakStrategy="highQuality"
                  >
                    {intl.formatMessage({
                      id: 'content__in_the_rare_event_staked_eth_will_be_lost_desc',
                    })}
                  </Typography.Body2>
                </Box>
              </Box>
            </Box>
          </Box>
        ),
      }}
    />
  );
}
