import { Page } from '@onekeyhq/components';
import BulkSendBar from '../../components/BulkSendBar';
import BulkSendContentWrapper from '../../components/BulkSendContentWrapper';
import BulkSendHeader from '../../components/BulkSendHeader';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import type { EModalBulkSendRoutes, IModalBulkSendParamList } from '@onekeyhq/shared/src/routes';
import { useCallback, useMemo, useState } from 'react';
import { BulkSendAmountsInputContext, type IBulkSendAmountsInputContext } from './components/Context';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

function BaseBulkSendAmountsInput() {
  const handleSubmit = useCallback(() => {
    console.log('handleSubmit');
  }, []);

  const isSubmitDisabled = useMemo(() => {
    return false;
  }, []);

  return <Page scrollEnabled>
    <BulkSendBar />
    <Page.Body>
      <BulkSendContentWrapper>
        <BulkSendHeader />
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
