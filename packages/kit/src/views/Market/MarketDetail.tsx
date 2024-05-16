import { useCallback, useMemo } from 'react';

import {
  HeaderIconButton,
  IconButton,
  Image,
  Page,
  SizableText,
  Tab,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import type { IPageScreenProps } from '@onekeyhq/components';
import type {
  ETabMarketRoutes,
  ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';

import { MarketHomeHeader } from './components/MarketHomeHeader';
import { MarketHomeHeader as MDMarketHomeHeader } from './components/MarketHomeHeader.md';
import { MarketHomeHeaderSearchBar } from './components/MarketHomeHeaderSearchBar';

function MarketDetail({
  route,
}: IPageScreenProps<ITabMarketParamList, ETabMarketRoutes.MarketDetail>) {
  const { icon, coinGeckoId, symbol } = route.params;
  const { result: categories } = usePromiseResult(
    async () => backgroundApiProxy.serviceMarket.fetchCategories(),
    [],
  );

  const { gtMd } = useMedia();

  const renderHeaderTitle = useCallback(
    () => (
      <XStack space="$2">
        <Image
          width="$6"
          height="$6"
          borderRadius="100%"
          src={decodeURIComponent(icon || '')}
        />
        <SizableText>{symbol?.toUpperCase()}</SizableText>
      </XStack>
    ),
    [icon, symbol],
  );

  const renderHeaderRight = useCallback(
    () => (
      <XStack space="$10" ai="center">
        <HeaderIconButton icon="ShareOutline" />
        {gtMd ? <MarketHomeHeaderSearchBar /> : null}
      </XStack>
    ),
    [gtMd],
  );

  return (
    <Page>
      <Page.Header
        headerTitle={renderHeaderTitle}
        headerRight={renderHeaderRight}
      />
    </Page>
  );
}

export default MarketDetail;
