import BigNumber from 'bignumber.js';

import { Page, YStack, useMedia } from '@onekeyhq/components';
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

import { isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import BulkSendBar from '../../components/BulkSendBar';
import BulkSendContentWrapper from '../../components/BulkSendContentWrapper';
import BulkSendHeader from '../../components/BulkSendHeader';

import {
  BulkSendAmountsInputContext,
  type IAmountInputError,
  type IAmountInputValues,
  type IBulkSendAmountsInputContext,
  useBulkSendAmountsInputContext,
} from './components/Context';
import TableLayout from './components/TableLayout';
import MobileLayout from './components/MobileLayout';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';

function BaseBulkSendAmountsInput() {
  const { tokenDetails, tokenDetailsState, bulkSendMode, isAmountValid } =
    useBulkSendAmountsInputContext();

  const media = useMedia();

  const handleSubmit = useCallback(() => {
    console.log('handleSubmit');
  }, []);

  const isSubmitDisabled = useMemo(() => {
    return (
      !tokenDetailsState.initialized ||
      (tokenDetailsState.isRefreshing && !tokenDetails) ||
      !isAmountValid
    );
  }, [
    tokenDetailsState.initialized,
    tokenDetailsState.isRefreshing,
    tokenDetails,
    isAmountValid,
  ]);

  return (
    <Page scrollEnabled>
      <BulkSendBar />
      <Page.Body>
        <BulkSendContentWrapper>
          <BulkSendHeader bulkSendMode={bulkSendMode} />
          <YStack gap="$6" $gtMd={{ gap: '$8' }}>
            {media.gtMd ? <TableLayout /> : <MobileLayout />}
          </YStack>
        </BulkSendContentWrapper>
      </Page.Body>
      <Page.Footer>
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
            onConfirmText="Next"
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

  // Calculate if current mode is valid
  const isAmountValid = useMemo(() => {
    switch (amountInputMode) {
      case EAmountInputMode.Specified:
        return (
          !amountInputErrors.specifiedAmount &&
          amountInputValues.specifiedAmount !== ''
        );
      case EAmountInputMode.Range:
        return (
          !amountInputErrors.rangeMin &&
          !amountInputErrors.rangeMax &&
          amountInputValues.rangeMin !== '' &&
          amountInputValues.rangeMax !== ''
        );
      case EAmountInputMode.Custom: {
        // Check if total amount doesn't exceed balance
        const totalAmount = receivers.reduce((sum, r) => {
          const amount = new BigNumber(r.amount || '0');
          return sum.plus(amount.isNaN() ? 0 : amount);
        }, new BigNumber(0));
        const balance = new BigNumber(tokenDetails?.balanceParsed ?? '0');
        return (
          totalAmount.isGreaterThan(0) &&
          totalAmount.isLessThanOrEqualTo(balance)
        );
      }
      default:
        return false;
    }
  }, [
    amountInputMode,
    amountInputErrors,
    amountInputValues,
    receivers,
    tokenDetails?.balanceParsed,
  ]);

  const [transfersInfo, setTransfersInfo] = useState<ITransferInfo[]>([]);

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
    const firstReceiver = receivers[0];
    if (bulkSendMode === EBulkSendMode.OneToMany) {
      if (!isUndefined(firstReceiver.amount)) {
        setAmountInputMode(EAmountInputMode.Custom);
      } else {
        setAmountInputMode(EAmountInputMode.Specified);
      }
    }
  }, [bulkSendMode, receivers]);

  useEffect(() => {
    const generateTransfersInfo = (): ITransferInfo[] => {
      switch (bulkSendMode) {
        case EBulkSendMode.OneToMany: {
          // One sender to multiple receivers
          const sender = senders[0];
          if (!sender) return [];
          return receivers.map((receiver) => ({
            from: sender.address,
            to: receiver.address,
            amount: receiver.amount ?? '',
            tokenInfo,
          }));
        }
        case EBulkSendMode.ManyToOne: {
          // Multiple senders to one receiver
          const receiver = receivers[0];
          if (!receiver) return [];
          return senders.map((sender) => ({
            from: sender.address,
            to: receiver.address,
            amount: sender.amount ?? '',
            tokenInfo,
          }));
        }
        case EBulkSendMode.ManyToMany: {
          // Multiple senders to multiple receivers (must be one-to-one)
          if (senders.length !== receivers.length) {
            throw new Error(
              `ManyToMany mode requires equal senders and receivers count. Got ${senders.length} senders and ${receivers.length} receivers.`,
            );
          }
          return senders.map((sender, i) => ({
            from: sender.address,
            to: receivers[i].address,
            amount: receivers[i].amount ?? sender.amount ?? '',
            tokenInfo,
          }));
        }
        default:
          return [];
      }
    };

    setTransfersInfo(generateTransfersInfo());
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
      isAmountValid,
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
      isAmountValid,
      tokenInfo,
    ],
  );

  return (
    <BulkSendAmountsInputContext.Provider value={context}>
      <BaseBulkSendAmountsInput />
    </BulkSendAmountsInputContext.Provider>
  );
}

export default BulkSendAmountsInput;
