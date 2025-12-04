import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  NumberSizeableText,
  Skeleton,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { RichBlock } from '../RichBlock/RichBlock';

import { Protocol } from './Protocol';

function DeFiListBlock() {
  const intl = useIntl();
  const media = useMedia();
  const [settings] = useSettingsPersistAtom();

  const {
    updateDeFiListOverview,
    updateDeFiListProtocols,
    updateDeFiListProtocolMap,
    updateDeFiListState,
  } = useDeFiListActions().current;

  const [overview] = useDeFiListOverviewAtom();
  const [{ isRefreshing, initialized }] = useDeFiListStateAtom();
  const [{ protocols }] = useDeFiListProtocolsAtom();

  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });

  usePromiseResult(async () => {
    if (!account || !network) {
      return;
    }

    if (networkUtils.isAllNetwork({ networkId: network.id })) {
      return;
    }

    updateDeFiListState({
      isRefreshing: true,
      initialized: false,
    });

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
  }, [
    account,
    network,
    updateDeFiListOverview,
    updateDeFiListProtocols,
    updateDeFiListProtocolMap,
    updateDeFiListState,
  ]);

  const renderSubTitle = useCallback(() => {
    if (media.gtMd) {
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
    media.gtMd,
    settings.currencyInfo.symbol,
    overview.totalValue,
    initialized,
    isRefreshing,
  ]);
  const renderContent = useCallback(() => {
    if (!initialized && isRefreshing) {
      return <ListLoading isTokenSelectorView={false} />;
    }

    return (
      <YStack gap="$5" flex={1}>
        {protocols.map((protocol) => (
          <Protocol
            key={`${protocol.networkId}-${protocol.protocol}`}
            protocol={protocol}
          />
        ))}
      </YStack>
    );
  }, [initialized, isRefreshing, protocols]);
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
