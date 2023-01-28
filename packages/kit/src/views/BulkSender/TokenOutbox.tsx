import { useCallback, useEffect, useMemo, useState } from 'react';

import { useFocusEffect, useNavigation } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import natsort from 'natsort';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  HStack,
  Icon,
  Pressable,
  Text,
  Token as TokenComponent,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type { ITransferInfo } from '@onekeyhq/engine/src/vaults/types';
import { useAppSelector } from '@onekeyhq/kit/src/hooks';
import { useManageTokensOfAccount } from '@onekeyhq/kit/src/hooks/useManageTokens';
import { useManageTokenprices } from '@onekeyhq/kit/src/hooks/useManegeTokenPrice';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';
import { getTokenValues } from '@onekeyhq/kit/src/utils/priceUtils';
import { SendRoutes } from '@onekeyhq/kit/src/views/Send/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import { useValidteReceiver } from './hooks';
import { ReceiverInput } from './ReceiverInput';
import { BulkSenderRoutes, BulkSenderTypeEnum } from './types';

import type { TokenReceiver } from './types';

interface Props {
  accountId: string;
  networkId: string;
  accountAddress: string;
  type: BulkSenderTypeEnum;
}

function TokenOutbox(props: Props) {
  const { accountId, networkId, accountAddress, type } = props;
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [receiver, setReceiver] = useState<TokenReceiver[]>([]);
  const [receiverFromOut, setReceiverFromOut] = useState<TokenReceiver[]>([]);
  const [isUploadMode, setIsUploadMode] = useState(false);
  const [isBuildingTx, setIsBuildingTx] = useState(false);
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const navigation = useNavigation();
  const { accountTokens, nativeToken, balances, loading } =
    useManageTokensOfAccount({
      accountId,
      networkId,
    });
  const { prices } = useManageTokenprices({ networkId, accountId });
  const { serviceBatchTransfer, serviceToken } = backgroundApiProxy;
  const vsCurrency = useAppSelector((s) => s.settings.selectedFiatMoneySymbol);
  const valueSortedTokens = useMemo(() => {
    const tokenValues = new Map<Token, BigNumber>();
    const sortedTokens = accountTokens
      .filter((t) => {
        const priceId = `${networkId}${
          t.tokenIdOnNetwork ? `-${t.tokenIdOnNetwork}` : ''
        }`;
        if (t.tokenIdOnNetwork && !prices?.[priceId]) {
          tokenValues.set(t, new BigNumber(-1));
        }
        const [v] = getTokenValues({
          tokens: [t],
          prices,
          balances,
          vsCurrency,
        });
        tokenValues.set(t, v);
        if (t.isNative) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const priceIda = `${networkId}${
          a.tokenIdOnNetwork ? `-${a.tokenIdOnNetwork}` : ''
        }`;
        const priceIdb = `${networkId}${
          b.tokenIdOnNetwork ? `-${b.tokenIdOnNetwork}` : ''
        }`;
        return (
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          tokenValues.get(b)!.comparedTo(tokenValues.get(a)!) ||
          new BigNumber(prices?.[priceIdb]?.[vsCurrency] || 0).comparedTo(
            new BigNumber(prices?.[priceIda]?.[vsCurrency] || 0),
          ) ||
          natsort({ insensitive: true })(a.name, b.name)
        );
      });

    return sortedTokens;
  }, [accountTokens, networkId, prices, balances, vsCurrency]);

  const isNative = type === BulkSenderTypeEnum.NativeToken;
  const initialToken = isNative ? nativeToken : valueSortedTokens[0];
  const formatedBalance = useMemo(
    () =>
      intl.formatMessage(
        { id: 'content__balance_str' },
        {
          0: balances[
            selectedToken?.tokenIdOnNetwork ||
              initialToken?.tokenIdOnNetwork ||
              'main'
          ],
        },
      ),
    [balances, intl, initialToken, selectedToken],
  );

  const { isValid, isValidating, errors } = useValidteReceiver({
    networkId,
    receiver,
    type,
  });

  const handleOnTokenSelected = useCallback((token: Token) => {
    setSelectedToken(token);
  }, []);

  const handleOnAmountChanged = useCallback(
    (amount: string) => {
      const receiverWithChangedAmount = receiver.map((item) => ({
        ...item,
        Amount: amount,
      }));

      setReceiverFromOut(receiverWithChangedAmount);
    },
    [receiver, setReceiverFromOut],
  );

  const handleOpenTokenSelector = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.BulkSender,
      params: {
        screen: BulkSenderRoutes.TokenSelector,
        params: {
          accountId,
          networkId,
          tokens: valueSortedTokens,
          balances,
          onTokenSelected: handleOnTokenSelected,
        },
      },
    });
  }, [
    accountId,
    balances,
    handleOnTokenSelected,
    navigation,
    networkId,
    valueSortedTokens,
  ]);

  const handleOpenAmountEditor = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.BulkSender,
      params: {
        screen: BulkSenderRoutes.AmountEditor,
        params: {
          onAmountChanged: handleOnAmountChanged,
        },
      },
    });
  }, [handleOnAmountChanged, navigation]);

  const handlePreviewTransfer = useCallback(async () => {
    if (receiver.length === 0 || isValidating || isBuildingTx || !isValid)
      return;
    const transferInfos: ITransferInfo[] = [];
    let prevNonce;

    setIsBuildingTx(true);
    const tokenAddress =
      selectedToken?.tokenIdOnNetwork || initialToken?.tokenIdOnNetwork;
    for (let i = 0; i < receiver.length; i += 1) {
      transferInfos.push({
        from: accountAddress,
        to: receiver[i].Address,
        amount: receiver[i].Amount,
        token: tokenAddress,
      });
    }
    const encodedApproveTxs =
      await serviceBatchTransfer.buildEncodedTxsFromBatchApprove({
        networkId,
        accountId,
        transferInfos,
      });

    const prevTx = encodedApproveTxs[encodedApproveTxs.length - 1];

    if (prevTx) {
      prevNonce = (prevTx as IEncodedTxEvm).nonce;
      prevNonce =
        prevNonce !== undefined
          ? new BigNumber(prevNonce).toNumber()
          : prevNonce;
    }

    const encodedTx =
      await serviceBatchTransfer.buildEncodedTxFromBatchTransfer({
        networkId,
        accountId,
        transferInfos,
        prevNonce,
      });

    setIsBuildingTx(false);

    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Send,
      params: {
        screen: SendRoutes.BatchSendConfirm,
        params: {
          networkId,
          accountId,
          feeInfoUseFeeInTx: false,
          feeInfoEditable: true,
          encodedTxs: [...encodedApproveTxs, encodedTx],
          transferCount: transferInfos.length,
          transferType: type,
          payloadInfo: {
            type: 'Transfer',
            transferInfos,
          },
        },
      },
    });
  }, [
    accountAddress,
    accountId,
    initialToken?.tokenIdOnNetwork,
    isBuildingTx,
    isValid,
    isValidating,
    navigation,
    networkId,
    receiver,
    selectedToken?.tokenIdOnNetwork,
    serviceBatchTransfer,
    type,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (accountId && networkId) {
        serviceToken.fetchAccountTokens({
          activeAccountId: accountId,
          activeNetworkId: networkId,
        });
      }
    }, [accountId, networkId, serviceToken]),
  );

  useEffect(() => {
    if (accountId && networkId) {
      setSelectedToken(null);
    }
  }, [accountId, networkId]);

  return (
    <Box paddingX={isVertical ? 4 : 0} paddingY={5}>
      <Pressable.Item
        disabled={loading || isNative}
        px={4}
        py={2}
        borderColor="border-default"
        borderWidth={1}
        borderRadius={12}
        onPress={handleOpenTokenSelector}
      >
        <HStack alignItems="center">
          <TokenComponent
            flex={1}
            size={8}
            showInfo
            showTokenVerifiedIcon={false}
            token={selectedToken || initialToken}
            name={selectedToken?.symbol || initialToken?.symbol}
            showExtra={false}
            description={formatedBalance}
          />
          {!isNative && (
            <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
          )}
        </HStack>
      </Pressable.Item>
      <Box mt={6}>
        <ReceiverInput
          accountId={accountId}
          networkId={networkId}
          setReceiver={setReceiver}
          receiverFromOut={receiverFromOut}
          setReceiverFromOut={setReceiverFromOut}
          receiverErrors={errors}
          type={type}
          isUploadMode={isUploadMode}
          setIsUploadMode={setIsUploadMode}
        />
      </Box>
      <Box display={isUploadMode ? 'none' : 'flex'}>
        <HStack mt={4} space={4}>
          <Button
            type="basic"
            size="xs"
            leftIconName="CurrencyDollarSolid"
            onPress={handleOpenAmountEditor}
          >
            {intl.formatMessage({ id: 'action__edit_amount' })}
          </Button>
        </HStack>
        <Box mt={4}>
          <Button
            isLoading={isValidating || isBuildingTx}
            isDisabled={
              isValidating || !isValid || receiver.length === 0 || isBuildingTx
            }
            type="primary"
            size="xl"
            maxW={isVertical ? 'full' : '280px'}
            onPress={handlePreviewTransfer}
          >
            {intl.formatMessage({ id: 'action__preview' })}
          </Button>
        </Box>
        <Text fontSize={14} color="text-subdued" mt={4}>
          {intl.formatMessage({ id: 'content__support_csv_txt_or_excel' })}
        </Text>
      </Box>
    </Box>
  );
}

export { TokenOutbox };
