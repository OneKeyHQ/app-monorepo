import { Page, SizableText, YStack } from '@onekeyhq/components';
import type { IModalNavigationProp } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import type { IMarketWidgetKind } from '@onekeyhq/shared/src/modules/MarketWidget/types';

import { EModalMarketRoutes } from '../router/types';

import { useMarketWidgetCopy } from './useMarketWidgetCopy';

import type { IModalMarketParamList } from '../router/types';

const kinds: IMarketWidgetKind[] = ['single', 'list'];

export const MarketWidgetList = () => {
  const copy = useMarketWidgetCopy();
  const navigation =
    useAppNavigation<IModalNavigationProp<IModalMarketParamList>>();

  const route = useAppRoute<
    IModalMarketParamList,
    EModalMarketRoutes.MarketWidgetList
  >();
  if (route.params?.needsBinding) {
    return (
      <Page scrollEnabled>
        <Page.Header title={copy.marketWidgets} />
        <Page.Body>
          <YStack p="$5" gap="$3">
            <SizableText size="$bodyLg">{copy.bindingHint}</SizableText>
            <SizableText size="$bodyLgMedium">
              {copy.configurations} › {copy.newConfiguration}
            </SizableText>
          </YStack>
        </Page.Body>
      </Page>
    );
  }

  return (
    <Page scrollEnabled>
      <Page.Header title={copy.marketWidgets} />
      <Page.Body>
        <YStack pb="$5">
          {kinds.map((kind) => (
            <ListItem
              key={kind}
              testID={`market-widget-settings-${kind}`}
              icon={
                kind === 'single' ? 'CryptoCoinOutline' : 'Layout3RowsOutline'
              }
              title={kind === 'single' ? copy.singleCoin : copy.marketList}
              drillIn
              onPress={() =>
                navigation.push(EModalMarketRoutes.MarketWidgetEditor, { kind })
              }
            />
          ))}
        </YStack>
      </Page.Body>
    </Page>
  );
};
