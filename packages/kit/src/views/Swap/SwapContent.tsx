import React, { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Alert,
  Box,
  Button,
  Center,
  Divider,
  IconButton,
  Typography,
} from '@onekeyhq/components';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  useNavigation,
  useSwap,
  useSwapEnabled,
  useSwapQuote,
} from '../../hooks';
import { useActiveWalletAccount } from '../../hooks/redux';
import { SendRoutes } from '../Send/types';

import TokenInput from './components/TokenInput';
import ExchangeRate from './ExchangeRate';
import { SwapRoutes } from './typings';

const SwapContent = () => {
  const intl = useIntl();
  const isSwapEnabled = useSwapEnabled();
  const { account, network } = useActiveWalletAccount();
  const {
    input,
    output,
    inputAmount,
    outputAmount,
    setInAmount,
    setOutAmount,
    setIndependentField,
    switchInputOutput,
  } = useSwap();
  const { refresh, data, isLoading, error } = useSwapQuote();
  const navigation = useNavigation();
  const onInputPress = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Swap,
      params: {
        screen: SwapRoutes.Input,
      },
    });
  }, [navigation]);
  const onOutputPress = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Swap,
      params: {
        screen: SwapRoutes.Output,
      },
    });
  }, [navigation]);
  const onInputChange = useCallback(
    (value: string) => {
      setInAmount(value);
      setIndependentField('INPUT');
      refresh();
    },
    [setInAmount, setIndependentField, refresh],
  );
  const onOutputChange = useCallback(
    (value: string) => {
      setOutAmount(value);
      setIndependentField('OUTPUT');
      refresh();
    },
    [setOutAmount, setIndependentField, refresh],
  );
  const onSwitch = useCallback(() => {
    switchInputOutput();
    refresh();
  }, [switchInputOutput, refresh]);

  const onSubmit = useCallback(async () => {
    if (data) {
      // check approve
      if (
        data.needApprove &&
        data.sellTokenAddress !== '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
      ) {
        if (account && network) {
          const allowance = await backgroundApiProxy.engine.getTokenAllowance({
            networkId: network?.id,
            accountId: account.id,
            tokenIdOnNetwork: data.sellTokenAddress,
            spender: data.allowanceTarget,
          });
          const bnAllowance = new BigNumber(allowance || '0');
          const bnInput = new BigNumber(data.sellAmount || '0');
          if (bnAllowance.lt(bnInput)) {
            const encodedTx =
              await backgroundApiProxy.engine.buildEncodedTxFromApprove({
                networkId: network.id,
                accountId: account.id,
                spender: data.allowanceTarget,
                token: data.sellTokenAddress,
                amount: 'unlimited',
              });
            console.log('encodedTx', encodedTx);
            //  approve transaction
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Send,
              params: {
                screen: SendRoutes.SendConfirm,
                params: {
                  encodedTx: { ...encodedTx, from: account?.address },
                  sourceInfo: {
                    id: '0',
                    origin: 'Swap Token Approve',
                    scope: 'ethereum',
                    data: data.data || '',
                  },
                },
              },
            });
            return;
          }
        }
      }
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Send,
        params: {
          screen: SendRoutes.SendConfirm,
          params: {
            encodedTx: { ...data, from: account?.address },
            sourceInfo: {
              id: '0',
              origin: 'OneKey Swap',
              scope: 'ethereum',
              data: data.data || '',
            },
          },
        },
      });
    }
  }, [data, account, navigation, network]);

  let buttonText = intl.formatMessage({ id: 'title__swap' });

  if (error) {
    buttonText = error;
  } else if (data?.needApprove) {
    buttonText = 'Approved';
  }

  return (
    <Center px="4">
      <Box
        bg="surface-default"
        shadow="depth.2"
        maxW="420"
        w="full"
        borderRadius={12}
        px="4"
        py="6"
      >
        <Box
          borderWidth="0.5"
          borderColor="border-default"
          bg="surface-subdued"
          borderRadius={12}
          position="relative"
        >
          <TokenInput
            label={intl.formatMessage({ id: 'content__from' })}
            token={input}
            inputValue={inputAmount}
            onChange={onInputChange}
            onPress={onInputPress}
          />
          <Box w="full" h="10" position="relative">
            <Box position="absolute" w="full" h="full">
              <Center w="full" h="full">
                <Divider />
              </Center>
            </Box>
            <Center>
              <IconButton
                w="10"
                h="10"
                name="SwitchVerticalSolid"
                borderRadius="full"
                borderColor="border-disabled"
                borderWidth="0.5"
                bg="surface-default"
                onPress={onSwitch}
              />
            </Center>
          </Box>
          <TokenInput
            label={intl.formatMessage({ id: 'content__to' })}
            token={output}
            inputValue={outputAmount}
            onChange={onOutputChange}
            onPress={onOutputPress}
          />
          {!isSwapEnabled ? (
            <Box w="full" h="full" position="absolute" />
          ) : null}
        </Box>
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          mt="2"
          mb="4"
        >
          <Typography.Body2 color="text-subdued">
            {intl.formatMessage({ id: 'Rate' })}
          </Typography.Body2>
          <Typography.Body2 color="text-default">
            {data && input?.symbol && output?.symbol ? (
              <ExchangeRate
                inputSymbol={input?.symbol}
                outputSymbol={output?.symbol}
                price={data.price}
              />
            ) : (
              '---'
            )}
          </Typography.Body2>
        </Box>
        {!isSwapEnabled ? (
          <Box mb="6">
            <Alert
              title={intl.formatMessage({ id: 'msg__wrong_network' })}
              description={intl.formatMessage({
                id: 'msg__wrong_network_desc',
              })}
              alertType="error"
              dismiss={false}
            />
          </Box>
        ) : null}
        <Button
          type="primary"
          isDisabled={!!error || !isSwapEnabled || !data}
          isLoading={isLoading}
          onPress={onSubmit}
        >
          {buttonText}
        </Button>
      </Box>
    </Center>
  );
};

export default SwapContent;
