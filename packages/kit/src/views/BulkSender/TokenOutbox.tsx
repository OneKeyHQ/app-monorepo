import { useCallback, useEffect, useMemo, useState } from 'react';

import { useFocusEffect, useNavigation } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  HStack,
  Icon,
  Pressable,
  Text,
  ToastManager,
  Token as TokenComponent,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type { ITransferInfo } from '@onekeyhq/engine/src/vaults/types';
import { useAccountTokens, useNetwork } from '@onekeyhq/kit/src/hooks';
import {
  useAccountTokenLoading,
  useTokenBalance,
} from '@onekeyhq/kit/src/hooks/useTokens';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';
import { SendRoutes } from '@onekeyhq/kit/src/views/Send/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import { showAmountEditor } from './AmountEditor';
import { showApprovalSelector } from './ApprovalSelector';
import { useValidteReceiver } from './hooks';
import { ReceiverExample } from './ReceiverExample';
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
  const [isUnlimited, setIsUnlimited] = useState(false);
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const navigation = useNavigation();
  const { network } = useNetwork({ networkId });

  const loading = useAccountTokenLoading(networkId, accountId);
  const accountTokens = useAccountTokens(networkId, accountId, true);
  const nativeToken = accountTokens.find((token) => token.isNative);
  const tokens = accountTokens.filter((token) => !token.isNative);

  const { serviceBatchTransfer, serviceToken, serviceOverview } =
    backgroundApiProxy;

  const isNative = type === BulkSenderTypeEnum.NativeToken;
  const initialToken = isNative ? nativeToken : tokens[0];

  const tokenBalnace = useTokenBalance({
    accountId,
    networkId,
    token: selectedToken || initialToken,
    fallback: '0',
  });
  const formatedBalance = useMemo(
    () =>
      intl.formatMessage(
        { id: 'content__balance_str' },
        {
          0: tokenBalnace,
        },
      ),
    [intl, tokenBalnace],
  );

  const { isValid, isValidating, errors } = useValidteReceiver({
    networkId,
    receiver,
    type,
    token: selectedToken || initialToken,
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
          tokens,
          onTokenSelected: handleOnTokenSelected,
        },
      },
    });
  }, [accountId, handleOnTokenSelected, navigation, networkId, tokens]);

  const handleOpenAmountEditor = useCallback(() => {
    showAmountEditor(handleOnAmountChanged);
  }, [handleOnAmountChanged]);

  const handleOpenApprovalSelector = useCallback(() => {
    showApprovalSelector({
      isUnlimited,
      setIsUnlimited,
    });
  }, [isUnlimited]);

  const verifyBulkTransferBeforeConfirm = useCallback(
    (transferInfos: ITransferInfo[], token?: Token) => {
      const totalAmount = transferInfos.reduce(
        (sum, next) => sum.plus(next.amount),
        new BigNumber(0),
      );

      if (totalAmount.gt(tokenBalnace)) {
        ToastManager.show(
          {
            title: intl.formatMessage(
              { id: 'form__amount_invalid' },
              { '0': token?.symbol },
            ),
          },
          { type: 'error' },
        );
        return false;
      }

      return true;
    },
    [tokenBalnace, intl],
  );

  const handlePreviewTransfer = useCallback(async () => {
    if (receiver.length === 0 || isValidating || isBuildingTx || !isValid)
      return;
    const transferInfos: ITransferInfo[] = [];
    let prevNonce;

    setIsBuildingTx(true);
    const token = selectedToken || initialToken;
    for (let i = 0; i < receiver.length; i += 1) {
      transferInfos.push({
        from: accountAddress,
        to: receiver[i].Address,
        amount: receiver[i].Amount,
        token: token?.tokenIdOnNetwork,
        sendAddress: token?.sendAddress,
      });
    }

    const verified = verifyBulkTransferBeforeConfirm(transferInfos, token);

    if (!verified) {
      setIsBuildingTx(false);
      return;
    }

    const encodedApproveTxs =
      await serviceBatchTransfer.buildEncodedTxsFromBatchApprove({
        networkId,
        accountId,
        transferInfos,
        isUnlimited,
      });

    const prevTx = encodedApproveTxs[encodedApproveTxs.length - 1];

    if (prevTx) {
      prevNonce = (prevTx as IEncodedTxEvm).nonce;
      prevNonce =
        prevNonce !== undefined
          ? new BigNumber(prevNonce).toNumber()
          : prevNonce;
    }

    const maxActionsInTx = network?.settings?.maxActionsInTx || 0;
    // const maxActionsInTx = 9;
    const transferInfoGroup = [];

    if (maxActionsInTx > 0) {
      for (
        let i = 0, len = transferInfos.length;
        i < len;
        i += maxActionsInTx
      ) {
        transferInfoGroup.push(transferInfos.slice(i, i + maxActionsInTx));
      }
    } else {
      transferInfoGroup.push(transferInfos);
    }

    const encodedTxs = [];

    for (let i = 0, len = transferInfoGroup.length; i < len; i += 1) {
      // @ts-ignore
      const encodedTx =
        await serviceBatchTransfer.buildEncodedTxFromBatchTransfer({
          networkId,
          accountId,
          transferInfos: transferInfoGroup[i],
          prevNonce,
        });
      prevNonce = (encodedTx as IEncodedTxEvm).nonce;
      prevNonce =
        prevNonce !== undefined
          ? new BigNumber(prevNonce).toNumber()
          : prevNonce;
      encodedTxs.push(encodedTx);
    }

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
          encodedTxs: [...encodedApproveTxs, ...encodedTxs],
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
    initialToken,
    isBuildingTx,
    isUnlimited,
    isValid,
    isValidating,
    navigation,
    network?.settings?.maxActionsInTx,
    networkId,
    receiver,
    selectedToken,
    serviceBatchTransfer,
    type,
    verifyBulkTransferBeforeConfirm,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (accountId && networkId) {
        serviceToken.startRefreshAccountTokens();
        serviceOverview.startQueryPendingTasks();
        serviceToken.fetchAccountTokens({
          activeAccountId: accountId,
          activeNetworkId: networkId,
        });
      }
      return () => {
        serviceToken.stopRefreshAccountTokens();
        serviceOverview.stopQueryPendingTasks();
      };
    }, [accountId, networkId, serviceOverview, serviceToken]),
  );

  useEffect(() => {
    if (accountId && networkId) {
      setSelectedToken(null);
    }
  }, [accountId, networkId]);

  return (
    <Tabs.ScrollView>
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
              name={selectedToken?.name || initialToken?.name}
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
          <Text fontSize={12} color="text-subdued" mt={isVertical ? 4 : 3}>
            {intl.formatMessage({
              id: 'content__deflationary_token_transfers_are_not_supported_at_this_moment',
            })}
          </Text>
          <HStack space={4} alignItems="center" flexWrap="wrap">
            <Button
              mt={4}
              type="basic"
              size="xs"
              leftIconName="CurrencyDollarSolid"
              onPress={handleOpenAmountEditor}
            >
              {intl.formatMessage({ id: 'action__edit_amount' })}
            </Button>
            {!isNative &&
              network?.settings.batchTokenTransferApprovalRequired && (
                <Button
                  mt={4}
                  type="basic"
                  size="xs"
                  leftIconName="CurrencyDollarSolid"
                  onPress={handleOpenApprovalSelector}
                >
                  {intl.formatMessage({
                    id: isUnlimited
                      ? 'action__approval_unlimited'
                      : 'action__approval_exact_amount',
                  })}
                </Button>
              )}
          </HStack>
          <Box mt={4}>
            <Button
              isLoading={isValidating || isBuildingTx}
              isDisabled={
                isValidating ||
                !isValid ||
                receiver.length === 0 ||
                isBuildingTx
              }
              type="primary"
              size="xl"
              maxW={isVertical ? 'full' : '280px'}
              onPress={handlePreviewTransfer}
            >
              {intl.formatMessage({ id: 'action__preview' })}
            </Button>
          </Box>
          <Box mt={4}>
            <ReceiverExample />
          </Box>
        </Box>
      </Box>
    </Tabs.ScrollView>
  );
}

export { TokenOutbox };
