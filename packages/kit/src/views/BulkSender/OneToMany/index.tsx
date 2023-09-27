import { useCallback, useEffect, useState } from 'react';

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
import { batchTransferContractAddress } from '@onekeyhq/engine/src/presets/batchTransferContractAddress';
import { BulkTypeEnum } from '@onekeyhq/engine/src/types/batchTransfer';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type { ITransferInfo } from '@onekeyhq/engine/src/vaults/types';
import {
  useAccountTokensOnChain,
  useNetwork,
  useTokenBalanceWithoutFrozen,
} from '@onekeyhq/kit/src/hooks';
import {
  HomeRoutes,
  MainRoutes,
  ModalRoutes,
  RootRoutes,
  SendModalRoutes,
  TabRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import {
  IMPL_TRON,
  isBTCNetwork,
} from '@onekeyhq/shared/src/engine/engineConsts';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AmountEditorTrigger } from '../AmountEditor/AmountEditorTrigger';
import { showApprovalSelector } from '../ApprovalSelector';
import { amountDefaultTypeMap } from '../constants';
import { useValidateTrader } from '../hooks';
import { TraderExample } from '../TraderExample';
import { TraderInput } from '../TraderInput';
import { TxSettingPanel } from '../TxSetting/TxSettingPanel';
import { TxSettingTrigger } from '../TxSetting/TxSettingTrigger';
import { AmountTypeEnum, BulkSenderRoutes, TraderTypeEnum } from '../types';

import type { RootRoutesParams } from '../../../routes/types';
import type { TokenTrader } from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface Props {
  accountId: string;
  networkId: string;
  accountAddress: string;
}

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Main
>;

const bulkType = BulkTypeEnum.OneToMany;

function OneToMany(props: Props) {
  const { accountId, networkId, accountAddress } = props;
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [receiver, setReceiver] = useState<TokenTrader[]>([]);
  const [receiverFromOut, setReceiverFromOut] = useState<TokenTrader[]>([]);
  const [isUploadMode, setIsUploadMode] = useState(false);
  const [isBuildingTx, setIsBuildingTx] = useState(false);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [isAlreadyUnlimited, setIsAlreadyUnlimited] = useState(false);
  const [isFetchingAllowance, setIsFetchingAllowance] = useState(false);

  const [amountType, setAmountType] = useState<AmountTypeEnum>(
    amountDefaultTypeMap[bulkType] ?? AmountTypeEnum.Fixed,
  );
  const [amount, setAmount] = useState<string[]>(['0']);

  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps>();
  const { network } = useNetwork({ networkId });

  const accountTokens = useAccountTokensOnChain(networkId, accountId);
  const tokens = accountTokens.filter((token) =>
    network?.impl === IMPL_TRON
      ? !new BigNumber(token.tokenIdOnNetwork).isInteger()
      : true && (isBTCNetwork(network?.id) ? token.isNative : true),
  );

  const { serviceBatchTransfer, serviceToken, serviceOverview } =
    backgroundApiProxy;

  const initialToken = tokens.find((token) => token.isNative) ?? tokens[0];
  const currentToken = selectedToken || initialToken;
  const isNative = currentToken?.isNative;

  const tokenBalance = useTokenBalanceWithoutFrozen({
    accountId,
    networkId,
    token: currentToken,
    fallback: '0',
    useRecycleBalance: currentToken?.isNative,
  });

  const { isValid, isValidating, errors } = useValidateTrader({
    networkId,
    trader: receiver,
    token: currentToken,
    shouldValidateAmount: amountType === AmountTypeEnum.Custom,
  });

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

  const handleOpenApprovalSelector = useCallback(() => {
    showApprovalSelector({
      isUnlimited,
      setIsUnlimited,
      isAlreadyUnlimited,
    });
  }, [isUnlimited, isAlreadyUnlimited]);

  const verifyBulkTransferBeforeConfirm = useCallback(
    (transferInfos: ITransferInfo[], token?: Token) => {
      const totalAmount = transferInfos.reduce(
        (sum, next) => sum.plus(next.amount),
        new BigNumber(0),
      );

      if (totalAmount.gt(tokenBalance)) {
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
    [tokenBalance, intl],
  );

  const handlePreviewTransfer = useCallback(async () => {
    try {
      if (receiver.length === 0 || isValidating || isBuildingTx || !isValid)
        return;
      const transferInfos: ITransferInfo[] = [];
      let prevNonce;

      setIsBuildingTx(true);
      const token = selectedToken || initialToken;
      for (let i = 0; i < receiver.length; i += 1) {
        transferInfos.push({
          from: accountAddress,
          to: receiver[i].address,
          amount: receiver[i].amount ?? amount[0],
          token: token?.tokenIdOnNetwork,
          tokenSendAddress: token?.sendAddress,
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
      const transferInfoGroup = [];
      if (
        maxActionsInTx > 0 &&
        (network?.settings?.hardwareMaxActionsEnabled
          ? accountId.startsWith('hw-')
          : true)
      ) {
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
          screen: SendModalRoutes.BatchSendConfirm,
          params: {
            networkId,
            accountId,
            feeInfoUseFeeInTx: false,
            feeInfoEditable: true,
            encodedTxs: [...encodedApproveTxs, ...encodedTxs],
            transferCount: transferInfos.length,
            bulkType,
            payloadInfo: {
              type: 'Transfer',
              transferInfos,
            },
          },
        },
      });
    } catch (error) {
      setIsBuildingTx(false);
      ToastManager.show(
        {
          title: typeof error === 'string' ? error : (error as Error).message,
        },
        { type: 'error' },
      );
    }
  }, [
    accountAddress,
    accountId,
    amount,
    initialToken,
    isBuildingTx,
    isUnlimited,
    isValid,
    isValidating,
    navigation,
    network?.settings?.hardwareMaxActionsEnabled,
    network?.settings?.maxActionsInTx,
    networkId,
    receiver,
    selectedToken,
    serviceBatchTransfer,
    verifyBulkTransferBeforeConfirm,
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
    const fetchTokenAllowance = async () => {
      const contract = batchTransferContractAddress[networkId];
      if (
        !isNative &&
        network?.settings.batchTransferApprovalRequired &&
        currentToken?.tokenIdOnNetwork &&
        contract
      ) {
        try {
          setIsFetchingAllowance(true);
          const { isUnlimited: isUnlimitedAllowance } =
            await serviceBatchTransfer.checkIsUnlimitedAllowance({
              networkId,
              owner: accountAddress,
              spender: contract,
              token: currentToken?.tokenIdOnNetwork,
            });
          setIsUnlimited(isUnlimitedAllowance);
          setIsAlreadyUnlimited(isUnlimitedAllowance);
          setIsFetchingAllowance(false);
        } catch {
          setIsFetchingAllowance(false);
        }
      }
    };
    fetchTokenAllowance();
  }, [
    accountAddress,
    currentToken?.tokenIdOnNetwork,
    isNative,
    network?.settings.batchTransferApprovalRequired,
    networkId,
    serviceBatchTransfer,
  ]);

  useEffect(() => {
    if (accountId && networkId) {
      setSelectedToken(null);
    }
  }, [accountId, networkId]);

  useEffect(() => {
    if (
      network &&
      !(network?.settings?.nativeSupportBatchTransfer
        ? true
        : batchTransferContractAddress[networkId])
    ) {
      navigation.replace(RootRoutes.Main, {
        screen: MainRoutes.Tab,
        params: {
          screen: TabRoutes.Home,
          params: {
            screen: HomeRoutes.BulkSender,
          },
        },
      });
    }
  }, [
    navigation,
    network,
    network?.settings?.nativeSupportBatchTransfer,
    networkId,
  ]);

  return (
    <Box>
      <TxSettingPanel>
        <TxSettingTrigger
          header={intl.formatMessage({ id: 'form__token' })}
          title={currentToken?.symbol ?? ''}
          desc={intl.formatMessage(
            { id: 'content__balance_str' },
            { 0: tokenBalance },
          )}
          icon={<TokenIcon size={10} token={currentToken} />}
          onPress={handleOpenTokenSelector}
        />
        <AmountEditorTrigger
          accountAddress={accountAddress}
          token={currentToken}
          handleOnAmountChanged={handleOnAmountChanged}
          transferCount={receiver.length}
          amount={amount}
          amountType={amountType}
          bulkType={bulkType}
          networkId={network?.id ?? ''}
        />
        {!isNative && network?.settings.batchTransferApprovalRequired && (
          <TxSettingTrigger
            isLoading={isFetchingAllowance}
            header={intl.formatMessage({ id: 'form__allowance' })}
            title={intl.formatMessage({
              id: isUnlimited ? 'form__unlimited' : 'form__exact_amount',
            })}
            desc={
              isAlreadyUnlimited && isUnlimited ? (
                <Text typography="Body2" color="text-success">
                  {intl.formatMessage({ id: 'form__approved' })}
                </Text>
              ) : (
                intl.formatMessage({ id: 'form__going_to_approve' })
              )
            }
            onPress={handleOpenApprovalSelector}
          />
        )}
      </TxSettingPanel>
      <Box mt={8}>
        <TraderInput
          header={intl.formatMessage({ id: 'form__receipient' })}
          withAmount
          accountId={accountId}
          networkId={networkId}
          token={currentToken}
          amount={amount}
          amountType={amountType}
          trader={receiver}
          setTrader={setReceiver}
          traderFromOut={receiverFromOut}
          setTraderFromOut={setReceiverFromOut}
          traderErrors={errors}
          isUploadMode={isUploadMode}
          setIsUploadMode={setIsUploadMode}
          traderType={TraderTypeEnum.Receiver}
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

      <Box display={isUploadMode ? 'none' : 'flex'}>
        {network?.settings?.nativeSupportBatchTransfer ? null : (
          <Text fontSize={12} color="text-subdued" mt={isVertical ? 4 : 3}>
            {intl.formatMessage({
              id: 'content__note_that_exchanges_may_not_accept_contract_transfers',
            })}
          </Text>
        )}
        <Box mt={4}>
          <Button
            isLoading={isValidating || isBuildingTx}
            isDisabled={
              isValidating ||
              !isValid ||
              receiver.length === 0 ||
              isBuildingTx ||
              isFetchingAllowance
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
          <TraderExample />
        </Box>
      </Box>
    </Box>
  );
}

export { OneToMany };
