import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  NumberSizeableText,
  Skeleton,
  Stack,
  YStack,
  useTabIsRefreshingFocused,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EmptyDeFi } from '@onekeyhq/kit/src/components/Empty';
import { ListLoading } from '@onekeyhq/kit/src/components/Loading';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useDeFiListActions,
  useDeFiListOverviewAtom,
  useDeFiListProtocolsAtom,
  useDeFiListStateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/deFiList';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_DEFI,
} from '@onekeyhq/shared/src/consts/walletConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { RichBlock } from '../RichBlock/RichBlock';

import { Protocol } from './Protocol';

const MAX_PROTOCOLS_ON_SMALL_SCREEN = 6;

function DeFiListBlock({ tableLayout }: { tableLayout?: boolean }) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();

  const {
    updateDeFiListOverview,
    updateDeFiListProtocols,
    updateDeFiListProtocolMap,
    updateDeFiListState,
  } = useDeFiListActions().current;

  const { isFocused, isHeaderRefreshing } = useTabIsRefreshingFocused();

  const [overview] = useDeFiListOverviewAtom();
  const [{ isRefreshing, initialized }] = useDeFiListStateAtom();
  const [{ protocols }] = useDeFiListProtocolsAtom();

  const [overflowState, setOverflowState] = useState<{
    isOverflow: boolean;
    isSliced: boolean;
  }>({
    isOverflow: false,
    isSliced: true,
  });

  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });

  usePromiseResult(
    async () => {
      if (!account || !network) {
        return;
      }

      if (networkUtils.isAllNetwork({ networkId: network.id })) {
        return;
      }

      await backgroundApiProxy.serviceDeFi.abortFetchAccountDeFiPositions();

      try {
        const resp =
          await backgroundApiProxy.serviceDeFi.fetchAccountDeFiPositions({
            accountId: account.id,
            networkId: network.id,
            accountAddress: account.address,
          });
        updateDeFiListOverview({
          overview: {
            totalValue: new BigNumber(resp.overview.totalValue ?? 0).toFixed(),
            totalDebt: new BigNumber(resp.overview.totalDebt ?? 0).toFixed(),
            netWorth: new BigNumber(resp.overview.netWorth ?? 0).toFixed(),
            chains: resp.overview.chains,
            protocolCount: resp.overview.protocolCount,
            positionCount: resp.overview.positionCount,
          },
        });
        updateDeFiListProtocols({
          protocols: resp.protocols,
        });
        updateDeFiListProtocolMap({
          protocolMap: resp.protocolMap,
        });
      } catch (e) {
        console.error(e);
      } finally {
        updateDeFiListState({
          isRefreshing: false,
          initialized: true,
        });
      }
    },
    [
      account,
      network,
      updateDeFiListOverview,
      updateDeFiListProtocols,
      updateDeFiListProtocolMap,
      updateDeFiListState,
    ],
    {
      overrideIsFocused: (isPageFocused) => isPageFocused && isFocused,
      debounced: POLLING_DEBOUNCE_INTERVAL,
      revalidateOnFocus: true,
      pollingInterval: POLLING_INTERVAL_FOR_DEFI,
    },
  );

  useEffect(() => {
    if (!tableLayout && protocols.length > MAX_PROTOCOLS_ON_SMALL_SCREEN) {
      setOverflowState((prev) => ({
        ...prev,
        isOverflow: true,
      }));
    }
  }, [protocols, tableLayout]);

  const filteredProtocols = useMemo(() => {
    if (overflowState.isOverflow && overflowState.isSliced) {
      return protocols.slice(0, MAX_PROTOCOLS_ON_SMALL_SCREEN);
    }
    return protocols;
  }, [protocols, overflowState.isOverflow, overflowState.isSliced]);

  const renderSubTitle = useCallback(() => {
    if (tableLayout) {
      if (!initialized && isRefreshing) {
        return <Skeleton.HeadingXl />;
      }

      return (
        <NumberSizeableText
          size="$headingXl"
          color="$textSubdued"
          formatter="value"
          formatterOptions={{
            currency: settings.currencyInfo.symbol,
          }}
        >
          {overview.totalValue}
        </NumberSizeableText>
      );
    }

    return null;
  }, [
    settings.currencyInfo.symbol,
    overview.totalValue,
    initialized,
    isRefreshing,
    tableLayout,
  ]);
  const renderContent = useCallback(() => {
    return (
      <>
        <YStack gap={tableLayout ? '$5' : '$0'} flex={1}>
          {filteredProtocols.map((protocol) => (
            <Protocol
              key={`${protocol.networkId}-${protocol.protocol}`}
              protocol={protocol}
              tableLayout={tableLayout}
            />
          ))}
        </YStack>
        {overflowState.isOverflow ? (
          <Stack
            alignItems="center"
            justifyContent="center"
            pt="$4"
            flexDirection={tableLayout ? 'row' : 'column'}
          >
            <Button
              size={tableLayout ? 'small' : 'medium'}
              variant="secondary"
              onPress={() =>
                setOverflowState((prev) => ({
                  ...prev,
                  isSliced: !prev.isSliced,
                }))
              }
            >
              {overflowState.isSliced
                ? intl.formatMessage({ id: ETranslations.global_show_more })
                : intl.formatMessage({ id: ETranslations.global_show_less })}
            </Button>
          </Stack>
        ) : null}
      </>
    );
  }, [
    filteredProtocols,
    tableLayout,
    intl,
    overflowState.isOverflow,
    overflowState.isSliced,
  ]);

  if (protocols.length === 0) {
    return (
      <RichBlock
        withTitleSeparator
        title={intl.formatMessage({ id: ETranslations.global_earn })}
        subTitle={renderSubTitle()}
        plainContentContainer={!tableLayout}
        content={
          !initialized && isRefreshing ? (
            <ListLoading
              itemProps={
                tableLayout
                  ? undefined
                  : {
                      mx: '$0',
                      px: '$0',
                    }
              }
              isTokenSelectorView={false}
            />
          ) : (
            <EmptyDeFi />
          )
        }
      />
    );
  }

  return (
    <RichBlock
      withTitleSeparator
      title={intl.formatMessage({ id: ETranslations.global_earn })}
      subTitle={renderSubTitle()}
      content={renderContent()}
      plainContentContainer
    />
  );
}

export { DeFiListBlock };
