import { useCallback } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Box, Center, Image, Modal, Typography } from '@onekeyhq/components';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ETHLogoPNG from '../../../../assets/staking/eth_staking.png';
import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount, useNativeToken } from '../../../hooks';
import { getActiveWalletAccount } from '../../../hooks/redux';
import { ModalRoutes, RootRoutes } from '../../../routes/types';
import { SendRoutes } from '../../Send/types';
import { useKelePoolStakingState } from '../hooks';

import type { StakingRoutes, StakingRoutesParams } from '../typing';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<StakingRoutesParams, StakingRoutes.StakingETHNotes>;

export default function StakingETHNotes() {
  const intl = useIntl();
  const navigation = useNavigation();
  const { params } = useRoute<RouteProps>();
  const { account } = useActiveWalletAccount();
  const state = useKelePoolStakingState(params.networkId, account?.id);
  const tokenInfo = useNativeToken(params.networkId);
  const onClose = useCallback(() => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) {
      parent.goBack();
    }
  }, [navigation]);
  const onSubmit = useCallback(async () => {
    if (account && tokenInfo) {
      try {
        await backgroundApiProxy.serviceStaking.registerOnKele({
          payeeAddr: account.address,
          networdId: params.networkId,
        });
      } catch {
        debugLogger.common.error('registerOnKele failed');
      }
      const encodedTx =
        await backgroundApiProxy.serviceStaking.buildTxForStakingETHtoKele({
          value: new BigNumber(10)
            .exponentiatedBy(18)
            .multipliedBy(params.amount)
            .toFixed(0),
          networkId: params.networkId,
        });
      onClose();
      const { networkId, accountId } = getActiveWalletAccount();
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Send,
        params: {
          screen: SendRoutes.SendConfirm,
          params: {
            networkId,
            accountId,
            payloadInfo: {
              type: 'InternalStake',
              stakeInfo: {
                tokenInfo,
                amount: params.amount,
                accountAddress: account.address,
              },
            },
            feeInfoEditable: true,
            feeInfoUseFeeInTx: false,
            encodedTx: { ...encodedTx, from: account?.address },
            onSuccess: (tx, data) => {
              backgroundApiProxy.serviceStaking.setAccountStakingActivity({
                networkId: params.networkId,
                accountId: account.id,
                data: {
                  nonce: data?.decodedTx?.nonce,
                  oldValue: state?.total,
                  txid: tx.txid,
                  amount: params.amount,
                  createdAt: Date.now(),
                  type: 'kele',
                },
              });
            },
          },
        },
      });
    }
  }, [
    account,
    params.networkId,
    params.amount,
    navigation,
    state?.total,
    tokenInfo,
    onClose,
  ]);
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
              <Box flexDirection="row">
                <Center
                  w="8"
                  h="8"
                  borderRadius="full"
                  bg="decorative-surface-one"
                  mr="4"
                >
                  <Typography.Body2Strong color="decorative-icon-one">
                    1
                  </Typography.Body2Strong>
                </Center>
                <Box flex="1">
                  <Typography.Body1Strong>
                    {intl.formatMessage({
                      id: 'content__staked_eth_can_t_be_taken_back_now',
                    })}
                  </Typography.Body1Strong>
                  <Typography.Body2 color="text-subdued">
                    {intl.formatMessage({
                      id: 'content__staked_eth_can_t_be_taken_back_now_desc',
                    })}
                  </Typography.Body2>
                </Box>
              </Box>
              <Box flexDirection="row" mt="5">
                <Center
                  w="8"
                  h="8"
                  borderRadius="full"
                  bg="decorative-surface-one"
                  mr="4"
                >
                  <Typography.Body2Strong color="decorative-icon-one">
                    2
                  </Typography.Body2Strong>
                </Center>
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
