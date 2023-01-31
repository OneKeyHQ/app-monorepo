import { useCallback, useEffect, useMemo, useState } from 'react';

import { useFocusEffect, useNavigation } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  HStack,
  Icon,
  IconButton,
  Pressable,
  Switch,
  Text,
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
import { showApprovalSelector } from './ApporvalSelector';
import { showDeflationaryTip } from './DeflationaryTip';
import { useValidteReceiver } from './hooks';
import { ReceiverInput } from './ReceiverInput';
import { BulkSenderRoutes, BulkSenderTypeEnum } from './types';
import { downloadReceiverExample } from './utils';

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
  const [isDeflationary, setIsDeflationary] = useState(false);
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

  const balance = useTokenBalance({
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
          0: balance,
        },
      ),
    [intl, balance],
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

    const encodedTx =
      await serviceBatchTransfer.buildEncodedTxFromBatchTransfer({
        networkId,
        accountId,
        transferInfos,
        prevNonce,
        isDeflationary:
          network?.settings?.supportDeflationary && isDeflationary,
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
    isDeflationary,
    isUnlimited,
    isValid,
    isValidating,
    navigation,
    network?.settings?.supportDeflationary,
    networkId,
    receiver,
    selectedToken?.tokenIdOnNetwork,
    serviceBatchTransfer,
    type,
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
      backgroundApiProxy.serviceOverview.subscribe();
    }
  }, [accountId, networkId]);

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
          <HStack space={4} alignItems="center" flexWrap="wrap">
            {network?.settings?.supportDeflationary && (
              <HStack alignItems="center" mt={4}>
                <Switch
                  isChecked={isDeflationary}
                  onToggle={() => setIsDeflationary(!isDeflationary)}
                  labelType="after"
                  label={intl.formatMessage({ id: 'action__deflationary' })}
                />
                <IconButton
                  ml={-2}
                  onPress={showDeflationaryTip}
                  size="xs"
                  name="InformationCircleOutline"
                  type="plain"
                  iconColor="icon-subdued"
                  circle
                />
              </HStack>
            )}
            <Button
              mt={4}
              type="basic"
              size="xs"
              leftIconName="CurrencyDollarSolid"
              onPress={handleOpenAmountEditor}
            >
              {intl.formatMessage({ id: 'action__edit_amount' })}
            </Button>
            {!isNative && (
              <Button
                mt={4}
                type="basic"
                size="xs"
                leftIconName="CurrencyDollarSolid"
                onPress={handleOpenApprovalSelector}
              >
                <Text>
                  Approval: {isUnlimited ? 'Unlimited' : 'Exact Amount'}
                </Text>
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
          <HStack mt={4} space="10px">
            <Text fontSize={14} color="text-subdued">
              {intl.formatMessage({ id: 'content__support_csv_txt_or_excel' })}
            </Text>
            <Pressable onPress={downloadReceiverExample}>
              <Text
                fontSize={14}
                color="text-subdued"
                textDecorationLine="underline"
              >
                {intl.formatMessage({ id: 'action__download_example' })}
              </Text>
            </Pressable>
          </HStack>
        </Box>
      </Box>
    </Tabs.ScrollView>
  );
}

export { TokenOutbox };
