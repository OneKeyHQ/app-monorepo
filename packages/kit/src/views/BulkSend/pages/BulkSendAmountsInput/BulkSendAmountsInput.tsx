import { Page } from '@onekeyhq/components';
import BulkSendBar from '../../components/BulkSendBar';
import BulkSendContentWrapper from '../../components/BulkSendContentWrapper';
import BulkSendHeader from '../../components/BulkSendHeader';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import type { EModalBulkSendRoutes, IModalBulkSendParamList } from '@onekeyhq/shared/src/routes';
import { useCallback, useMemo, useState } from 'react';
import { BulkSendAmountsInputContext, type IBulkSendAmountsInputContext, useBulkSendAmountsInputContext } from './components/Context';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';
import { usePromiseResult } from '../../../../hooks/usePromiseResult';
import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { POLLING_DEBOUNCE_INTERVAL, POLLING_INTERVAL_FOR_TOKEN } from '@onekeyhq/shared/src/consts/walletConsts';
import { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';

function BaseBulkSendAmountsInput() {
  const { tokenDetails, tokenDetailsState, bulkSendMode } = useBulkSendAmountsInputContext();
  const handleSubmit = useCallback(() => {
    console.log('handleSubmit');
  }, []);

  const isSubmitDisabled = useMemo(() => {
    return !tokenDetailsState.initialized || (tokenDetailsState.isRefreshing && !tokenDetails);
  }, [tokenDetailsState.initialized, tokenDetailsState.isRefreshing, tokenDetails]);

  return <Page scrollEnabled>
    <BulkSendBar />
    <Page.Body>
      <BulkSendContentWrapper>
        <BulkSendHeader bulkSendMode={bulkSendMode} />
      </BulkSendContentWrapper>
    </Page.Body>
    <Page.Footer>
      <BulkSendContentWrapper $gtMd={{
        mt: '$0',
        px: '$0',
        mx: 'auto',
        maxWidth: '$180',
      }}>
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
}

function BulkSendAmountsInput() {

  const route = useAppRoute<
    IModalBulkSendParamList,
    EModalBulkSendRoutes.BulkSendAmountsInput
  >();

  const { networkId, accountId, senders, receivers, tokenInfo, bulkSendMode } =
    route.params ?? {};

  const [tokenDetails, setTokenDetails] = useState<({ info: IToken } & ITokenFiat) | undefined>(undefined);
  const [tokenDetailsState, setTokenDetailsState] = useState<{
    initialized: boolean;
    isRefreshing: boolean;
  }>({
    initialized: false,
    isRefreshing: false,
  });


  usePromiseResult(async () => {
    if (bulkSendMode === EBulkSendMode.OneToMany && accountId && networkId && tokenInfo) {
      setTokenDetailsState(prev => ({
        ...prev,
        isRefreshing: true,
      }));
      const [checkInscriptionProtectionEnabled, vaultSettings] =
        await Promise.all([
          backgroundApiProxy.serviceSetting.checkInscriptionProtectionEnabled({
            networkId,
            accountId,
          }),
          backgroundApiProxy.serviceNetwork.getVaultSettings({
            networkId,
          }),
        ]);
      const withCheckInscription =
        checkInscriptionProtectionEnabled && vaultSettings.hasFrozenBalance;

      try {
        const resp = await backgroundApiProxy.serviceToken.fetchTokensDetails({
          accountId,
          networkId,
          contractList: [tokenInfo.address],
          withFrozenBalance: true,
          withCheckInscription,
        });

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
  }, [networkId, accountId, tokenInfo, bulkSendMode],
    { debounced: POLLING_DEBOUNCE_INTERVAL, pollingInterval: POLLING_INTERVAL_FOR_TOKEN });



  const context = useMemo<IBulkSendAmountsInputContext>(() => ({
    accountId,
    networkId,
    tokenDetails,
    setTokenDetails,
    tokenDetailsState,
    setTokenDetailsState,
    bulkSendMode,
    senders,
    receivers,
  }), [networkId, accountId, tokenDetails, tokenDetailsState, bulkSendMode, senders, receivers]);


  return (
    <BulkSendAmountsInputContext.Provider value={context}>
      <BaseBulkSendAmountsInput />
    </BulkSendAmountsInputContext.Provider>
  )
}

export default BulkSendAmountsInput;
