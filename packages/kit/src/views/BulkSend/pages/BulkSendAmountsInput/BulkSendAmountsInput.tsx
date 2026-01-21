import BigNumber from 'bignumber.js';

import { Page } from '@onekeyhq/components';
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

import { AmountInputSection } from './components/AmountInput';
import {
  BulkSendAmountsInputContext,
  type IAmountInputError,
  type IAmountInputValues,
  type IBulkSendAmountsInputContext,
  useBulkSendAmountsInputContext,
} from './components/Context';

function BaseBulkSendAmountsInput() {
  const { tokenDetails, tokenDetailsState, bulkSendMode, isAmountValid } =
    useBulkSendAmountsInputContext();

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
          <AmountInputSection />
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

  const context = useMemo<IBulkSendAmountsInputContext>(
    () => ({
      accountId,
      networkId,
      tokenDetails,
      setTokenDetails,
      tokenDetailsState,
      setTokenDetailsState,
      bulkSendMode,
      senders,
      receivers,
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
      senders,
      receivers,
      amountInputMode,
      amountInputValues,
      amountInputErrors,
      isAmountValid,
    ],
  );

  return (
    <BulkSendAmountsInputContext.Provider value={context}>
      <BaseBulkSendAmountsInput />
    </BulkSendAmountsInputContext.Provider>
  );
}

export default BulkSendAmountsInput;
