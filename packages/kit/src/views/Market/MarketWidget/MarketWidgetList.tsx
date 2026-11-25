import { useEffect, useState } from 'react';

import { useIntl } from 'react-intl';
import { AppState } from 'react-native';

import { Page, SizableText, YStack } from '@onekeyhq/components';
import type { IModalNavigationProp } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import marketWidget from '@onekeyhq/shared/src/modules/MarketWidget';
import { logMarketWidgetEvent } from '@onekeyhq/shared/src/modules/MarketWidget/diagnostics';
import type { IMarketWidgetKind } from '@onekeyhq/shared/src/modules/MarketWidget/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';

import { EModalMarketRoutes } from '../router/types';

import { MarketWidgetStateView } from './MarketWidgetStateView';
import { useMarketWidgetCopy } from './useMarketWidgetCopy';

import type { IModalMarketParamList } from '../router/types';

const kinds: IMarketWidgetKind[] = ['single', 'list'];

export const MarketWidgetList = () => {
  const intl = useIntl();
  const copy = useMarketWidgetCopy();
  const navigation =
    useAppNavigation<IModalNavigationProp<IModalMarketParamList>>();

  const route = useAppRoute<
    IModalMarketParamList,
    EModalMarketRoutes.MarketWidgetList
  >();
  const needsBinding = route.params?.needsBinding;
  const [isActive, setIsActive] = useState(
    () => (AppState.currentState ?? 'active') === 'active',
  );
  const shouldListInstances =
    platformEnv.isNativeIOS &&
    !needsBinding &&
    isActive &&
    !travelModeManager.isMaskingDataSync();
  const installed = usePromiseResult(
    async () => {
      if (!shouldListInstances) return undefined;
      try {
        return {
          instances: (await marketWidget.getInstalledInstances?.()) ?? [],
        };
      } catch (error) {
        logMarketWidgetEvent('editor.instances_failed', {}, undefined, error);
        return { hasError: true };
      }
    },
    [shouldListInstances],
    {
      checkIsFocused: true,
      revalidateOnFocus: true,
      undefinedResultIfReRun: true,
    },
  );
  useEffect(() => {
    if (!platformEnv.isNativeIOS || needsBinding) return undefined;
    const subscription = AppState.addEventListener('change', (state) =>
      setIsActive(state === 'active'),
    );
    return () => subscription.remove();
  }, [needsBinding]);

  if (needsBinding) {
    return (
      <Page scrollEnabled>
        <Page.Header title={copy.marketWidgets} />
        <Page.Body>
          <YStack p="$5" gap="$3">
            <SizableText size="$bodyLg">{copy.bindingHint}</SizableText>
          </YStack>
        </Page.Body>
      </Page>
    );
  }

  const items = [
    ...(shouldListInstances ? (installed.result?.instances ?? []) : []),
    ...kinds.map((kind) => ({
      kind,
      id: undefined,
      instanceNumber: undefined,
      symbols: undefined,
    })),
  ];
  const defaultLabel = platformEnv.isNativeIOS
    ? intl.formatMessage({ id: ETranslations.global_default })
    : undefined;

  return (
    <Page scrollEnabled>
      <Page.Header title={copy.marketWidgets} />
      <Page.Body>
        <YStack pb="$5">
          {items.map(({ kind, id, instanceNumber, symbols }) => {
            const title = kind === 'single' ? copy.singleCoin : copy.marketList;
            return (
              <ListItem
                key={id ?? kind}
                testID={`market-widget-settings-${id ?? kind}`}
                icon={
                  kind === 'single' ? 'CryptoCoinOutline' : 'Layout3RowsOutline'
                }
                title={instanceNumber ? `${title} #${instanceNumber}` : title}
                subtitle={
                  id
                    ? symbols?.join(' · ') || copy.assetUnavailable
                    : defaultLabel
                }
                drillIn
                onPress={() =>
                  navigation.push(EModalMarketRoutes.MarketWidgetEditor, {
                    kind,
                    ...(id ? { profileId: id } : {}),
                  })
                }
              />
            );
          })}
          {shouldListInstances && installed.result?.hasError ? (
            <MarketWidgetStateView
              privacyMasked={false}
              isLoading={false}
              hasError
              onRetry={() => installed.run()}
            />
          ) : null}
        </YStack>
      </Page.Body>
    </Page>
  );
};
