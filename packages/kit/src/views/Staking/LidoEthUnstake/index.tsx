import { useCallback, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  HStack,
  Modal,
  Text,
  ToastManager,
  Typography,
} from '@onekeyhq/components';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AutoSizeText } from '../../../components/AutoSizeText';
import { useActiveWalletAccount } from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { addTransaction } from '../../../store/reducers/staking';
import { formatAmount } from '../../../utils/priceUtils';
import { SendModalRoutes } from '../../Send/types';
import { StakingKeyboard } from '../components/StakingKeyboard';
import { useLidoOverview } from '../hooks';

import type { StakingRoutesParams } from '../typing';

type NavigationProps = ModalScreenProps<StakingRoutesParams>;

export default function UnstakeAmount() {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { account, networkId } = useActiveWalletAccount();
  const lidoOverview = useLidoOverview(networkId, account?.id);
  const balance = lidoOverview?.balance ?? '0';
  const tokenSymbol = networkId === OnekeyNetwork.eth ? 'ETH' : 'TETH';
  const [amount, setAmount] = useState('');

  const errorMsg = useMemo(() => {
    if (!amount) {
      return 'error';
    }
    const amountBN = new BigNumber(amount);
    const balanceBN = new BigNumber(balance);
    if (
      amountBN.isNaN() ||
      balanceBN.isNaN() ||
      balanceBN.isLessThan(amountBN)
    ) {
      return intl.formatMessage(
        { id: 'form__amount_invalid' },
        { 0: tokenSymbol },
      );
    }
    return undefined;
  }, [amount, intl, balance, tokenSymbol]);

  const userInput = useCallback(
    (percent: number) => {
      const bn = new BigNumber(balance);
      if (bn.lte(0)) {
        return;
      }
      const value = bn.multipliedBy(percent).dividedBy(100);
      setAmount(formatAmount(value, 8));
    },
    [balance],
  );

  const onPrimaryActionPress = useCallback(async () => {
    if (!account) {
      return;
    }
    const value = new BigNumber(amount).shiftedBy(18).toFixed(0);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
    const accountId = account.id;

    const message = await backgroundApiProxy.serviceStaking.buildStEthPermit({
      accountId,
      networkId,
      value,
      deadline,
    });

    if (!message) {
      ToastManager.show(
        { title: intl.formatMessage({ id: 'form__failed' }) },
        { type: 'error' },
      );
      return;
    }

    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Send,
      params: {
        screen: SendModalRoutes.SignMessageConfirm,
        params: {
          accountId: account.id,
          networkId,
          hideToast: true,
          unsignedMessage: {
            type: 4,
            message,
          },
          onSuccess: async (signature: string) => {
            const r = `0x${signature.substring(2).substring(0, 64)}`;
            const s = `0x${signature.substring(2).substring(64, 128)}`;
            const v = parseInt(signature.substring(2).substring(128, 130), 16);

            const permitTx =
              await backgroundApiProxy.serviceStaking.buildRequestWithdrawalsWithPermit(
                {
                  networkId,
                  amounts: [value],
                  owner: account.address,
                  permit: { v, s, r, value, deadline },
                },
              );

            const encodedTx: IEncodedTxEvm = {
              ...permitTx,
              from: account.address,
            };

            setTimeout(() => {
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
                            type: 'lidoUnstake',
                            nonce: data?.decodedTx?.nonce,
                            addedTime: Date.now(),
                          },
                        }),
                      );
                    },
                  },
                },
              });
            }, 700);
          },
        },
      },
    });
  }, [account, amount, networkId, navigation, intl]);

  return (
    <Modal
      header={intl.formatMessage(
        { id: 'title__unstake_str' },
        { '0': tokenSymbol },
      )}
      headerDescription="Lido"
      primaryActionTranslationId="action__next"
      hideSecondaryAction
      primaryActionProps={{
        isDisabled: !!errorMsg || new BigNumber(amount).lte(0),
      }}
      onPrimaryActionPress={onPrimaryActionPress}
    >
      <Box flex="1">
        <Box flex="1" flexDirection="column" justifyContent="space-between">
          <Center flex="1" flexDirection="column" justifyContent="space-around">
            <Center flex="1" maxH="140px">
              <Text
                textAlign="center"
                typography="DisplayLarge"
                color="text-subdued"
              >
                {tokenSymbol}
              </Text>
              <Center flex="1" minH="30px">
                <AutoSizeText
                  autoFocus
                  text={amount}
                  onChangeText={setAmount}
                  placeholder="0"
                />
              </Center>
            </Center>
            <Center>
              <HStack flexDirection="row" alignItems="center" space="3">
                <Button size="sm" onPress={() => userInput(25)}>
                  25%
                </Button>
                <Button size="sm" onPress={() => userInput(50)}>
                  50%
                </Button>
                <Button size="sm" onPress={() => userInput(75)}>
                  75%
                </Button>
                <Button size="sm" onPress={() => userInput(100)}>
                  {intl.formatMessage({ id: 'action__max' })}
                </Button>
              </HStack>
              <Box
                h="8"
                flexDirection="row"
                alignItems="center"
                justifyContent="center"
              >
                <Typography.Body2 color="text-subdued" mr="1">
                  {intl.formatMessage({ id: 'content__available_balance' })}
                </Typography.Body2>
                <Typography.Body2Strong
                  color={errorMsg && amount ? 'text-critical' : 'text-default'}
                >
                  {balance ?? ''} {tokenSymbol}
                </Typography.Body2Strong>
              </Box>
            </Center>
          </Center>
        </Box>
        <StakingKeyboard text={amount} onTextChange={setAmount} />
      </Box>
    </Modal>
  );
}
