import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Empty,
  ListView,
  Page,
  Spinner,
  Stack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalStakingParamList } from '@onekeyhq/shared/src/routes';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';

import {
  PageFrame,
  isErrorState,
  isLoadingState,
} from '../../components/PageFrame';

const LoadingSkeleton = () => (
  <Stack w="100%" h="$40" jc="center" ai="center">
    <Spinner size="large" />
  </Stack>
);

const ListEmptyComponent = () => <Empty title="No items withdraw" />;

type IUniversalWithdrawItem = { id: string; amount: string };

const UniversalWithdrawItem = ({
  item,
  tokenLogo,
  tokenSymbol,
}: {
  item: IUniversalWithdrawItem;
  tokenLogo?: string;
  tokenSymbol?: string;
}) => {
  const appNavigation = useAppNavigation();
  const appRoute = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.UniversalClaimOptions
  >();
  const { accountId, networkId, symbol, provider, details } = appRoute.params;
  const [loading, setLoading] = useState(false);
  const intl = useIntl();
  return (
    <ListItem
      avatarProps={{ src: tokenLogo, size: 32 }}
      title={`${item.amount} ${tokenSymbol ?? ''}`}
    >
      <Button
        variant="primary"
        size="small"
        loading={loading}
        onPress={async () => {
          try {
            setLoading(true);
            appNavigation.push(EModalStakingRoutes.UniversalWithdraw, {
              accountId,
              networkId,
              symbol,
              provider,
              identity: item.id,
              amount: item.amount,
              details,
            });
          } finally {
            setLoading(false);
          }
        }}
      >
        {intl.formatMessage({ id: ETranslations.earn_claim })}
      </Button>
    </ListItem>
  );
};

const UniversalWithdrawOptions = () => {
  const appRoute = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.UniversalClaimOptions
  >();
  const { accountId, networkId, symbol, provider } = appRoute.params;
  console.log('UniversalWithdrawOptions');
  const { result, isLoading, run } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getWithdrawList({
        networkId,
        accountId,
        symbol,
        provider,
      }),
    [accountId, networkId, symbol, provider],
    { watchLoading: true },
  );

  const renderItem = useCallback(
    ({ item }: { item: IUniversalWithdrawItem }) => (
      <UniversalWithdrawItem
        item={item}
        tokenLogo={result?.token.logoURI}
        tokenSymbol={result?.token.symbol}
      />
    ),
    [result],
  );

  const intl = useIntl();

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.earn_claim })}
      />
      <Page.Body>
        <PageFrame
          LoadingSkeleton={LoadingSkeleton}
          loading={isLoadingState({ result, isLoading })}
          error={isErrorState({ result, isLoading })}
          onRefresh={run}
        >
          {result ? (
            <ListView
              estimatedItemSize="$5"
              data={result.items}
              renderItem={renderItem}
              ListEmptyComponent={ListEmptyComponent}
            />
          ) : null}
        </PageFrame>
      </Page.Body>
    </Page>
  );
};

export default UniversalWithdrawOptions;
