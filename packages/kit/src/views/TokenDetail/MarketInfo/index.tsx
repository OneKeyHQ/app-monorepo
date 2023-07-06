import type { FC } from 'react';
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Empty,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import { isValidCoingeckoId } from '@onekeyhq/engine/src/managers/token';

import { MarketDetailComponent } from '../../Market/Components/MarketDetail/MarketDetailComponent';
import { useMarketDetail } from '../../Market/hooks/useMarketDetail';

type Props = {
  coingeckoId?: string;
};

const Detail: FC<{ coingeckoId: string }> = ({ coingeckoId }) => {
  const { tokenDetail } = useMarketDetail({ coingeckoId });
  const { bottom } = useSafeAreaInsets();

  return (
    <Box mt="20px" mb={bottom}>
      <MarketDetailComponent
        low24h={tokenDetail?.stats?.low24h}
        high24h={tokenDetail?.stats?.high24h}
        marketCapRank={tokenDetail?.stats?.marketCapRank}
        marketCap={tokenDetail?.stats?.marketCap}
        volume24h={tokenDetail?.stats?.volume24h}
        expolorers={tokenDetail?.explorers}
        about={tokenDetail?.about}
        links={tokenDetail?.links}
        atl={tokenDetail?.stats?.atl}
        ath={tokenDetail?.stats?.ath}
      />
    </Box>
  );
};

const Header: FC<Props> = ({ coingeckoId }) => {
  const intl = useIntl();

  if (coingeckoId && isValidCoingeckoId(coingeckoId)) {
    return <Detail coingeckoId={coingeckoId} />;
  }
  return (
    <Box py="24px" flexDirection="column" alignItems="center">
      <Empty
        emoji="🤷‍♀️"
        title={intl.formatMessage({ id: 'empty__no_info' })}
        subTitle={intl.formatMessage({
          id: 'empty__no_info_desc',
        })}
      />
    </Box>
  );
};

const MarketInfo: FC<Props> = ({ coingeckoId }) => {
  const isVerticalLayout = useIsVerticalLayout();

  const ListHeaderComponent = useCallback(
    () => <Header coingeckoId={coingeckoId} />,
    [coingeckoId],
  );

  return (
    <Tabs.FlatList
      contentContainerStyle={{
        width: '100%',
        alignSelf: 'center',
        paddingHorizontal: isVerticalLayout ? 16 : 32,
      }}
      ListHeaderComponent={ListHeaderComponent}
      data={[]}
      renderItem={() => null}
    />
  );
};

export default MarketInfo;
