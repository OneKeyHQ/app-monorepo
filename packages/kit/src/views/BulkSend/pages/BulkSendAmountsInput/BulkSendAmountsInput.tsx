import { Page, useMedia } from '@onekeyhq/components';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_TOKEN,
} from '@onekeyhq/shared/src/consts/walletConsts';
import type {
  EModalBulkSendRoutes,
  IModalBulkSendParamList,
} from '@onekeyhq/shared/src/routes';
import {
  EAmountInputMode,
  EBulkSendMode,
} from '@onekeyhq/shared/types/bulkSend';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { useCallback, useEffect, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import BulkSendBar from '../../components/BulkSendBar';
import BulkSendContentWrapper from '../../components/BulkSendContentWrapper';
import BulkSendHeader from '../../components/BulkSendHeader';

import {
  BulkSendAmountsInputContext,
  type IBulkSendAmountsInputContext,
  useBulkSendAmountsInputContext,
} from './components/Context';
import TableLayout from './components/TableLayout';
import MobileLayout from './components/MobileLayout';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  type IAmountInputError,
  type IAmountInputValues,
  type ITransferInfoErrors,
} from '@onekeyhq/shared/types/bulkSend';
import { calculateIsAmountValid, calculateTotalAmounts } from '../../utils';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import BigNumber from 'bignumber.js';

function BaseBulkSendAmountsInput() {
  const { tokenDetails, tokenDetailsState, bulkSendMode, isAmountValid, isInsufficientBalance } =
    useBulkSendAmountsInputContext();

  const navigation = useAppNavigation();

  const media = useMedia();

  const handleSubmit = useCallback(() => {
    console.log('handleSubmit');
  }, []);

  const isSubmitDisabled = useMemo(() => {
    return (
      !tokenDetailsState.initialized ||
      (tokenDetailsState.isRefreshing && !tokenDetails) ||
      !isAmountValid ||
      isInsufficientBalance
    );
  }, [
    tokenDetailsState.initialized,
    tokenDetailsState.isRefreshing,
    tokenDetails,
    isAmountValid,
    isInsufficientBalance,
  ]);

  return (
    <Page scrollEnabled>
      <BulkSendBar />
      <Page.Body>
        <BulkSendContentWrapper>
          <BulkSendHeader bulkSendMode={bulkSendMode} />
          {media.gtMd ? <TableLayout /> : <MobileLayout />}
        </BulkSendContentWrapper>
      </Page.Body>
      <Page.Footer borderTopWidth={1} borderColor="$borderDefault">
        <BulkSendContentWrapper
          $gtMd={{
            mt: '$0',
            px: '$0',
            mx: 'auto',
            maxWidth: '$180',
          }}
        >
          <Page.FooterActions
            $gtMd={{
              px: '$0',
            }}
            onConfirmText="Review"
            onCancelText="Back"
            cancelButtonProps={{
              onPress: () => {
                navigation.pop();
              },
            }}
            confirmButtonProps={{
              onPress: handleSubmit,
              disabled: isSubmitDisabled,
            }}
          />
        </BulkSendContentWrapper>
      </Page.Footer>
    </Page>
  );
}

function BulkSendAmountsInput() {
  const route = useAppRoute<
    IModalBulkSendParamList,
    EModalBulkSendRoutes.BulkSendAmountsInput
  >();

  const { networkId, accountId, senders, receivers, tokenInfo, bulkSendMode } =
    route.params ?? {};

  const [tokenDetails, setTokenDetails] = useState<
    ({ info: IToken } & ITokenFiat) | undefined
  >(undefined);
  const [tokenDetailsState, setTokenDetailsState] = useState<{
    initialized: boolean;
    isRefreshing: boolean;
  }>({
    initialized: false,
    isRefreshing: false,
  });
  const [amountInputMode, setAmountInputMode] = useState<EAmountInputMode>(
    EAmountInputMode.Specified,
  );

  // Amount input values state
  const [amountInputValues, setAmountInputValues] =
    useState<IAmountInputValues>({
      specifiedAmount: '',
      rangeMin: '',
      rangeMax: '',
    });

  // Amount input errors state
  const [amountInputErrors, setAmountInputErrors] = useState<IAmountInputError>(
    {},
  );

  // Transfer info errors state
  const [transferInfoErrors, setTransferInfoErrors] =
    useState<ITransferInfoErrors>({});

  const [transfersInfo, setTransfersInfo] = useState<ITransferInfo[]>([]);

  // Calculate if current mode is valid using shared logic
  const isAmountValid = useMemo(
    () =>
      calculateIsAmountValid({
        amountInputMode,
        amountInputErrors,
        amountInputValues,
        transferInfoErrors
      }),
    [amountInputMode, amountInputErrors, amountInputValues, transferInfoErrors],
  );

  const [isInsufficientBalance, setIsInsufficientBalance] = useState(false);

  const { totalTokenAmount, totalFiatAmount } = useMemo(
    () =>
      calculateTotalAmounts({
        transfersInfo,
        tokenPrice: tokenDetails?.price,
      }),
    [transfersInfo, tokenDetails?.price],
  );

  useEffect(() => {
    if (bulkSendMode === EBulkSendMode.OneToMany && tokenDetails) {
      const totalTokenAmountBN = new BigNumber(totalTokenAmount ?? '0');
      setIsInsufficientBalance(totalTokenAmountBN.gt(tokenDetails.balanceParsed));
    }
  }, [totalTokenAmount, tokenDetails?.balanceParsed, bulkSendMode, tokenDetails]);

  usePromiseResult(
    async () => {
      if (
        bulkSendMode === EBulkSendMode.OneToMany &&
        accountId &&
        networkId &&
        tokenInfo
      ) {
        setTokenDetailsState((prev) => ({
          ...prev,
          isRefreshing: true,
        }));
        const [checkInscriptionProtectionEnabled, vaultSettings] =
          await Promise.all([
            backgroundApiProxy.serviceSetting.checkInscriptionProtectionEnabled(
              {
                networkId,
                accountId,
              },
            ),
            backgroundApiProxy.serviceNetwork.getVaultSettings({
              networkId,
            }),
          ]);
        const withCheckInscription =
          checkInscriptionProtectionEnabled && vaultSettings.hasFrozenBalance;

        try {
          const resp = await backgroundApiProxy.serviceToken.fetchTokensDetails(
            {
              accountId,
              networkId,
              contractList: [tokenInfo.address],
              withFrozenBalance: true,
              withCheckInscription,
            },
          );

          if (resp[0]) {
            setTokenDetails(resp[0]);
            setTokenDetailsState({
              initialized: true,
              isRefreshing: false,
            });
          } else {
            setTokenDetails(undefined);
          }
        } catch (_) {
          setTokenDetails(undefined);
        } finally {
          setTokenDetailsState({
            initialized: true,
            isRefreshing: false,
          });
        }
      }
    },
    [networkId, accountId, tokenInfo, bulkSendMode],
    {
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_TOKEN,
    },
  );

  useEffect(() => {
    const generateTransfersInfo = (): ITransferInfo[] => {
      switch (bulkSendMode) {
        case EBulkSendMode.OneToMany: {
          const sender = senders[0];
          if (!sender) return [];
          return receivers.map((receiver) => ({
            from: sender.address,
            to: receiver.address,
            amount: receiver.amount ?? '0',
            tokenInfo,
          }));
        }
        case EBulkSendMode.ManyToOne: {
          const receiver = receivers[0];
          if (!receiver) return [];
          return senders.map((sender) => ({
            from: sender.address,
            to: receiver.address,
            amount: sender.amount ?? '0',
            tokenInfo,
          }));
        }
        case EBulkSendMode.ManyToMany: {
          if (senders.length !== receivers.length) {
            throw new OneKeyLocalError(
              `ManyToMany mode requires equal senders and receivers count. Got ${senders.length} senders and ${receivers.length} receivers.`,
            );
          }
          return senders.map((sender, i) => ({
            from: sender.address,
            to: receivers[i].address,
            amount: receivers[i].amount ?? sender.amount ?? '0',
            tokenInfo,
          }));
        }
        default:
          return [];
      }
    };

    const _transfersInfo = generateTransfersInfo();

    if (
      _transfersInfo.every(
        (transfer) => transfer.amount === _transfersInfo[0].amount,
      )
    ) {
      setAmountInputMode(EAmountInputMode.Specified);
    } else {
      setAmountInputMode(EAmountInputMode.Custom);
    }

    setTransfersInfo(_transfersInfo);
  }, [bulkSendMode, senders, receivers, tokenInfo]);

  const context = useMemo<IBulkSendAmountsInputContext>(
    () => ({
      accountId,
      networkId,
      tokenInfo,
      tokenDetails,
      setTokenDetails,
      tokenDetailsState,
      setTokenDetailsState,
      bulkSendMode,
      transfersInfo,
      setTransfersInfo,
      amountInputMode,
      setAmountInputMode,
      amountInputValues,
      setAmountInputValues,
      amountInputErrors,
      setAmountInputErrors,
      transferInfoErrors,
      setTransferInfoErrors,
      isAmountValid,
      totalTokenAmount,
      totalFiatAmount,
      isInsufficientBalance,
    }),
    [
      networkId,
      accountId,
      tokenDetails,
      tokenDetailsState,
      bulkSendMode,
      transfersInfo,
      setTransfersInfo,
      amountInputMode,
      amountInputValues,
      amountInputErrors,
      transferInfoErrors,
      isAmountValid,
      tokenInfo,
      totalTokenAmount,
      totalFiatAmount,
      isInsufficientBalance,
    ],
  );

  return (
    <BulkSendAmountsInputContext.Provider value={context}>
      <BaseBulkSendAmountsInput />
    </BulkSendAmountsInputContext.Provider>
  );
}

export default BulkSendAmountsInput;
