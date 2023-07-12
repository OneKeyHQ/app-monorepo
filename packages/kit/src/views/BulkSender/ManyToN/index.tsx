import { useCallback, useEffect, useMemo, useState } from 'react';

import { useFocusEffect, useNavigation } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Text,
  ToastManager,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { TokenIcon } from '@onekeyhq/components/src/Token';
import { BulkTypeEnum } from '@onekeyhq/engine/src/types/batchTransfer';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type { ITransferInfo } from '@onekeyhq/engine/src/vaults/types';
import {
  useAccountTokensOnChain,
  useAppSelector,
  useNetwork,
} from '@onekeyhq/kit/src/hooks';
import {
  ModalRoutes,
  RootRoutes,
  SendModalRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import { IMPL_TRON } from '@onekeyhq/shared/src/engine/engineConsts';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AmountEditorTrigger } from '../AmountEditor/AmountEditorTrigger';
import { amountDefaultTypeMap } from '../constants';
import { useValidteTrader } from '../hooks';
import { TraderExample } from '../TraderExample';
import { TraderInput } from '../TraderInput';
import { TxSettingPanel } from '../TxSetting/TxSettingPanel';
import { TxSettingTrigger } from '../TxSetting/TxSettingTrigger';
import { AmountTypeEnum, BulkSenderRoutes, TraderTypeEnum } from '../types';

import { getTransferAmount, verifyBulkTransferBeforeConfirm } from './utils';

import type { TokenTrader, TraderError } from '../types';
import { Account } from '@onekeyhq/engine/src/types/account';

interface Props {
  accountId: string;
  networkId: string;
  accountAddress: string;
  bulkType: BulkTypeEnum;
}

function ManyToN(props: Props) {
  const { accountId, networkId, bulkType } = props;
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [sender, setSender] = useState<TokenTrader[]>([]);
  const [senderFromOut, setSenderFromOut] = useState<TokenTrader[]>([]);
  const [receiver, setReceiver] = useState<TokenTrader[]>([]);
  const [receiverFromOut, setReceiverFromOut] = useState<TokenTrader[]>([]);
  const [isUploadSenderMode, setIsUploadSenderMode] = useState(false);
  const [isUploadReceiverMode, setIsUploadReceiverMode] = useState(false);
  const [isBuildingTx, setIsBuildingTx] = useState(false);
  const [verifySenderErrors, setVerifySenderErrors] = useState<TraderError[]>(
    [],
  );

  const [feePresetIndex, setFeePresetIndex] = useState('1');

  const [amountType, setAmountType] = useState<AmountTypeEnum>(
    amountDefaultTypeMap[bulkType] ?? AmountTypeEnum.Fixed,
  );
  const [amount, setAmount] = useState<string[]>(['0', '1']);

  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const navigation = useNavigation();
  const { network } = useNetwork({ networkId });
  const balances = useAppSelector((s) => s.tokens.accountTokensBalance);

  const accountTokens = useAccountTokensOnChain(networkId, accountId, true);
  const tokens = accountTokens.filter((token) =>
    network?.impl === IMPL_TRON
      ? !new BigNumber(token.tokenIdOnNetwork).isInteger()
      : true,
  );

  const { serviceBatchTransfer, serviceToken, serviceOverview } =
    backgroundApiProxy;

  const initialToken = tokens.find((token) => token.isNative) ?? tokens[0];
  const currentToken = selectedToken || initialToken;
  const isNative = currentToken?.isNative;

  const {
    isValid: isValidSender,
    isValidating: isValidatingSender,
    errors: senderErrors,
  } = useValidteTrader({
    networkId,
    trader: sender,
    token: currentToken,
    bulkType,
    traderType: TraderTypeEnum.Sender,
    amountType,
  });

  const {
    isValid: isValidReceiver,
    isValidating: isValidatingReceiver,
    errors: receiverErrors,
  } = useValidteTrader({
    networkId,
    trader: receiver,
    token: currentToken,
    bulkType,
    traderType: TraderTypeEnum.Receiver,
    amountType,
  });

  const isDisabled = useMemo(
    () =>
      receiver.length === 0 ||
      sender.length === 0 ||
      isValidatingReceiver ||
      isValidatingSender ||
      isBuildingTx ||
      !isValidReceiver ||
      !isValidSender,
    [
      receiver,
      sender,
      isValidatingReceiver,
      isValidatingSender,
      isBuildingTx,
      isValidReceiver,
      isValidSender,
    ],
  );

  const handleOnTokenSelected = useCallback((token: Token) => {
    setSelectedToken(token);
  }, []);

  const handleOnAmountChanged = useCallback(
    ({
      amount: amountFromEditor,
      amountType: amountTypeFromEditor,
    }: {
      amount: string[];
      amountType: AmountTypeEnum;
    }) => {
      let receiverWithChangedAmount = [];

      if (amountTypeFromEditor === AmountTypeEnum.Custom) {
        receiverWithChangedAmount = receiver.map((item) => ({
          ...item,
          Amount: amountFromEditor[0] ?? '0',
        }));
      } else {
        receiverWithChangedAmount = receiver.map((item) => ({
          ...item,
        }));
      }

      setAmount(amountFromEditor);
      setAmountType(amountTypeFromEditor);

      setReceiverFromOut(receiverWithChangedAmount);
    },
    [receiver],
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

  const handlePreviewTransfer = useCallback(async () => {
    if (isDisabled) return;
    const transferInfos: ITransferInfo[] = [];

    setIsBuildingTx(true);

    const { isVerified, errors, senderAccounts } =
      await verifyBulkTransferBeforeConfirm({
        networkId,
        sender,
        receiver,
        amount,
        amountType,
        bulkType,
        token: currentToken,
        balances,
        feePresetIndex,
      });

    if (!isVerified) {
      setIsBuildingTx(false);
      setVerifySenderErrors(errors ?? []);
      return;
    }

    for (let i = 0; i < sender.length; i += 1) {
      transferInfos.push({
        from: sender[i].Address,
        to:
          bulkType === BulkTypeEnum.ManyToOne
            ? receiver[0].Address
            : receiver[i].Address,
        amount: await getTransferAmount({
          networkId,
          amount,
          amountType,
          token: currentToken,
          senderItem: sender[i],
          balances,
        }),
        token: currentToken?.tokenIdOnNetwork,
        tokenSendAddress: currentToken?.sendAddress,
      });
    }

    const encodedTxs = [];

    for (let i = 0, len = transferInfos.length; i < len; i += 1) {
      // @ts-ignore
      const encodedTx =
        await backgroundApiProxy.engine.buildEncodedTxFromTransfer({
          networkId,
          accountId,
          transferInfo: transferInfos[i],
        });
      encodedTxs.push(encodedTx);
    }

    setIsBuildingTx(false);

    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Send,
      params: {
        screen: SendModalRoutes.BatchSendConfirm,
        params: {
          networkId,
          accountId,
          feeInfoUseFeeInTx: false,
          feeInfoEditable: true,
          feeInfoReuseable: true,
          encodedTxs,
          transferCount: transferInfos.length,
          payloadInfo: {
            type: 'Transfer',
            transferInfos,
            senderAccounts,
            tokenInfo: currentToken,
          },
          bulkType,
          amountType,
        },
      },
    });
  }, [
    accountId,
    amount,
    amountType,
    balances,
    bulkType,
    currentToken,
    feePresetIndex,
    isDisabled,
    navigation,
    networkId,
    receiver,
    sender,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (accountId && networkId) {
        serviceOverview.startQueryPendingTasks();
        serviceToken.fetchAccountTokens({
          accountId,
          networkId,
        });
      }
      return () => {
        serviceOverview.stopQueryPendingTasks();
      };
    }, [accountId, networkId, serviceOverview, serviceToken]),
  );

  useEffect(() => {
    if (accountId && networkId) {
      setSelectedToken(null);
    }
  }, [accountId, networkId]);

  const transferCount = useMemo(() => {
    if (bulkType === BulkTypeEnum.ManyToOne) {
      return sender.length;
    }

    return BigNumber.min(sender.length, receiver.length).toNumber();
  }, [bulkType, receiver.length, sender.length]);

  return (
    <Box>
      <TxSettingPanel>
        <TxSettingTrigger
          header={intl.formatMessage({ id: 'form__token' })}
          title={currentToken?.symbol ?? ''}
          icon={<TokenIcon size={10} token={currentToken} />}
          onPress={handleOpenTokenSelector}
        />
        <AmountEditorTrigger
          token={currentToken}
          handleOnAmountChanged={handleOnAmountChanged}
          transferCount={transferCount}
          amount={amount}
          amountType={amountType}
          bulkType={bulkType}
          networkId={network?.id ?? ''}
        />
      </TxSettingPanel>
      <Box mt={8}>
        <TraderInput
          header={
            amountType === AmountTypeEnum.Custom
              ? 'Sender Address, Amount'
              : 'Sender'
          }
          accountId={accountId}
          networkId={networkId}
          token={currentToken}
          amount={amount}
          amountType={amountType}
          setTrader={setSender}
          traderFromOut={senderFromOut}
          setTraderFromOut={setSenderFromOut}
          traderErrors={
            senderErrors.length > 0 ? senderErrors : verifySenderErrors
          }
          isUploadMode={isUploadSenderMode}
          setIsUploadMode={setIsUploadSenderMode}
        />
      </Box>
      <Box mt={8}>
        <TraderInput
          header="Receiptent"
          accountId={accountId}
          networkId={networkId}
          token={currentToken}
          amount={amount}
          amountType={amountType}
          setTrader={setReceiver}
          traderFromOut={receiverFromOut}
          setTraderFromOut={setReceiverFromOut}
          traderErrors={receiverErrors}
          isUploadMode={isUploadReceiverMode}
          setIsUploadMode={setIsUploadReceiverMode}
        />
      </Box>
      <Text fontSize={12} color="text-subdued" mt={isVertical ? 4 : 3}>
        {intl.formatMessage({
          id: 'form__each_line_should_include_the_address_and_the_amount_seperated_by_commas',
        })}
      </Text>
      <Box
        display={isUploadSenderMode || isUploadReceiverMode ? 'none' : 'flex'}
      >
        <Box mt={4}>
          <Button
            isLoading={
              isValidatingSender || isValidatingReceiver || isBuildingTx
            }
            isDisabled={isDisabled}
            type="primary"
            size="xl"
            maxW={isVertical ? 'full' : '280px'}
            onPress={handlePreviewTransfer}
          >
            {intl.formatMessage({ id: 'action__preview' })}
          </Button>
        </Box>
        <Box mt={4}>
          <TraderExample />
        </Box>
      </Box>
    </Box>
  );
}

export { ManyToN };
