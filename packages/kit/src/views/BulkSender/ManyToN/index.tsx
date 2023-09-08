import { useCallback, useEffect, useMemo, useState } from 'react';

import { useFocusEffect, useNavigation } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Box, Button, Text, useIsVerticalLayout } from '@onekeyhq/components';
import { TokenIcon } from '@onekeyhq/components/src/Token';
import { BulkTypeEnum } from '@onekeyhq/engine/src/types/batchTransfer';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type { ITransferInfo } from '@onekeyhq/engine/src/vaults/types';
import {
  useAccountTokensOnChain,
  useNativeToken,
  useNetwork,
} from '@onekeyhq/kit/src/hooks';
import {
  ModalRoutes,
  RootRoutes,
  SendModalRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import { IMPL_TRON } from '@onekeyhq/shared/src/engine/engineConsts';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { appSelector } from '../../../store';
import { AmountEditorTrigger } from '../AmountEditor/AmountEditorTrigger';
import { amountDefaultTypeMap } from '../constants';
import { useValidateTrader } from '../hooks';
import { IntervalEditorTrigger } from '../IntervalEditor/IntervalEditorTrigger';
import { TraderExample } from '../TraderExample';
import { TraderInput } from '../TraderInput';
import { TxSettingPanel } from '../TxSetting/TxSettingPanel';
import { TxSettingTrigger } from '../TxSetting/TxSettingTrigger';
import {
  AmountTypeEnum,
  BulkSenderRoutes,
  IntervalTypeEnum,
  TraderTypeEnum,
} from '../types';

import {
  getTransferAmount,
  getTxInterval,
  verifyBulkTransferBeforeConfirm,
} from './utils';

import type { TokenTrader, TraderError } from '../types';

interface Props {
  accountId: string;
  networkId: string;
  walletId: string;
  accountAddress: string;
  bulkType: BulkTypeEnum;
}

const DEFAULT_FEE_PRESET_INDEX = '2';

function ManyToN(props: Props) {
  const { accountId, networkId, walletId, bulkType, accountAddress } = props;
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

  const [amountType, setAmountType] = useState<AmountTypeEnum>(
    amountDefaultTypeMap[bulkType] ?? AmountTypeEnum.Fixed,
  );
  const [amount, setAmount] = useState<string[]>(['0', '1']);
  const [txInterval, setTxInterval] = useState<string[]>(['1', '5']);
  const [intervalType, setIntervalType] = useState(IntervalTypeEnum.Random);

  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const navigation = useNavigation();
  const { network } = useNetwork({ networkId });
  const { wallets } = appSelector((s) => s.runtime);

  const accountTokens = useAccountTokensOnChain(networkId, accountId);
  const tokens = accountTokens.filter((token) =>
    network?.impl === IMPL_TRON
      ? !new BigNumber(token.tokenIdOnNetwork).isInteger()
      : true,
  );

  const { serviceToken, serviceOverview } = backgroundApiProxy;

  const initialToken = tokens.find((token) => token.isNative) ?? tokens[0];
  const currentToken = selectedToken || initialToken;
  const nativeToken = useNativeToken(networkId);

  const {
    isValid: isValidSender,
    isValidating: isValidatingSender,
    errors: senderErrors,
  } = useValidateTrader({
    networkId,
    trader: sender,
    token: currentToken,
    shouldValidateAmount: amountType === AmountTypeEnum.Custom,
  });

  const {
    isValid: isValidReceiver,
    isValidating: isValidatingReceiver,
    errors: receiverErrors,
  } = useValidateTrader({
    networkId,
    trader: receiver,
    token: currentToken,
    shouldValidateAmount: false,
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
      let senderWithChangedAmount = [];

      if (amountTypeFromEditor === AmountTypeEnum.Custom) {
        senderWithChangedAmount = sender.map((item) => ({
          ...item,
          Amount: amountFromEditor[0] ?? '0',
        }));
      } else {
        senderWithChangedAmount = sender.map((item) => ({
          ...item,
        }));
      }

      setAmount(amountFromEditor);
      setAmountType(amountTypeFromEditor);

      setSenderFromOut(senderWithChangedAmount);
    },
    [sender],
  );

  const handleOnIntervalChanged = useCallback(
    ({
      txInterval: value,
      intervalType: type,
    }: {
      txInterval: string[];
      intervalType: IntervalTypeEnum;
    }) => {
      setTxInterval(value);
      setIntervalType(type);
    },
    [],
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
    setVerifySenderErrors([]);

    const { isVerified, errors, senderAccounts, tokensBalance } =
      await verifyBulkTransferBeforeConfirm({
        networkId,
        walletId,
        sender,
        receiver,
        amount,
        amountType,
        bulkType,
        token: currentToken,
        nativeToken,
        feePresetIndex: DEFAULT_FEE_PRESET_INDEX,
        intl,
        wallets,
      });

    if (!isVerified) {
      setIsBuildingTx(false);
      setVerifySenderErrors(errors ?? []);
      return;
    }

    for (let i = 0; i < sender.length; i += 1) {
      transferInfos.push({
        from: sender[i].address,
        to:
          bulkType === BulkTypeEnum.ManyToOne
            ? receiver[0].address
            : receiver[i].address,
        amount: await getTransferAmount({
          networkId,
          amount,
          amountType,
          token: currentToken,
          senderItem: sender[i],
          tokensBalance,
        }),
        token: currentToken?.tokenIdOnNetwork,
        tokenSendAddress: currentToken?.sendAddress,
        // send first tx without delay
        txInterval:
          i === 0
            ? undefined
            : getTxInterval({
                txInterval,
                intervalType,
              }),
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
          feeInfoSelected: {
            type: 'preset',
            preset: DEFAULT_FEE_PRESET_INDEX,
          },
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
    bulkType,
    currentToken,
    intervalType,
    intl,
    isDisabled,
    nativeToken,
    navigation,
    networkId,
    receiver,
    sender,
    txInterval,
    walletId,
    wallets,
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

  useEffect(() => {
    setVerifySenderErrors([]);
  }, [sender]);

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
          accountAddress={accountAddress}
          token={currentToken}
          handleOnAmountChanged={handleOnAmountChanged}
          transferCount={transferCount}
          amount={amount}
          amountType={amountType}
          bulkType={bulkType}
          networkId={network?.id ?? ''}
        />
        <IntervalEditorTrigger
          txInterval={txInterval}
          intervalType={intervalType}
          handleOnIntervalChanged={handleOnIntervalChanged}
        />
      </TxSettingPanel>
      <Box mt={8}>
        <TraderInput
          header={intl.formatMessage({ id: 'form__sender' })}
          withAmount
          accountId={accountId}
          networkId={networkId}
          token={currentToken}
          amount={amount}
          amountType={amountType}
          trader={sender}
          setTrader={setSender}
          traderType={TraderTypeEnum.Sender}
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
          header={intl.formatMessage({ id: 'form__receipient' })}
          isSingleMode={bulkType === BulkTypeEnum.ManyToOne}
          accountId={accountId}
          networkId={networkId}
          token={currentToken}
          amount={amount}
          amountType={amountType}
          trader={receiver}
          setTrader={setReceiver}
          traderType={TraderTypeEnum.Receiver}
          traderFromOut={receiverFromOut}
          setTraderFromOut={setReceiverFromOut}
          traderErrors={receiverErrors}
          isUploadMode={isUploadReceiverMode}
          setIsUploadMode={setIsUploadReceiverMode}
        />
      </Box>
      <Text fontSize={12} color="text-subdued" mt={isVertical ? 4 : 3}>
        {amountType === AmountTypeEnum.Custom
          ? `${intl.formatMessage({
              id: 'content__each_line_should_include_the_address_and_amount',
            })} ${accountAddress}, 0.1`
          : `${intl.formatMessage({
              id: 'content__each_line_should_include_the_address',
            })} ${accountAddress}`}
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
