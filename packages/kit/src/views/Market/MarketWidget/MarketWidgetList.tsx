import { useIntl } from 'react-intl';

import { Alert, Empty, Page, SizableText, YStack } from '@onekeyhq/components';
import type { IModalNavigationProp } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketWidgetKind } from '@onekeyhq/shared/src/modules/MarketWidget/types';

import { EModalMarketRoutes } from '../router/types';

import { getMarketWidgetAssetTitle } from './assetIdentity';
import { MarketWidgetStateView } from './MarketWidgetStateView';
import { useMarketWidgetCopy } from './useMarketWidgetCopy';
import { useMarketWidgetEditorState } from './useMarketWidgetEditorState';

import type { IModalMarketParamList } from '../router/types';

const kinds: IMarketWidgetKind[] = ['single', 'list'];

export default function MarketWidgetList() {
  const intl = useIntl();
  const copy = useMarketWidgetCopy();
  const navigation =
    useAppNavigation<IModalNavigationProp<IModalMarketParamList>>();
  const route = useAppRoute<
    IModalMarketParamList,
    EModalMarketRoutes.MarketWidgetList
  >();
  const editor = useMarketWidgetEditorState();
  const kindFilter = route.params?.kind;
  const availableKinds = kinds.filter(
    (kind) => !kindFilter || kindFilter === kind,
  );
  const profiles = editor.state?.profiles.filter(
    (profile) => !kindFilter || profile.kind === kindFilter,
  );

  return (
    <Page scrollEnabled>
      <Page.Header title={copy.marketWidgets} />
      <Page.Body>
        {!editor.state || editor.privacyMasked ? (
          <MarketWidgetStateView {...editor} onRetry={editor.refresh} />
        ) : (
          <YStack gap="$5" pb="$5">
            <YStack px="$5">
              <Alert type="info" description={copy.bindingHint} />
            </YStack>
            <YStack>
              <SizableText
                px="$5"
                mb="$2"
                size="$headingSm"
                color="$textSubdued"
              >
                {copy.newConfiguration}
              </SizableText>
              {availableKinds.map((kind) => (
                <ListItem
                  key={kind}
                  testID={`market-widget-create-${kind}`}
                  icon={
                    kind === 'single'
                      ? 'CryptoCoinOutline'
                      : 'Layout3RowsOutline'
                  }
                  title={kind === 'single' ? copy.singleCoin : copy.marketList}
                  drillIn
                  onPress={() =>
                    navigation.push(EModalMarketRoutes.MarketWidgetEditor, {
                      kind,
                    })
                  }
                />
              ))}
            </YStack>
            {profiles?.length ? (
              <YStack>
                <SizableText
                  px="$5"
                  mb="$2"
                  size="$headingSm"
                  color="$textSubdued"
                >
                  {copy.configurations}
                </SizableText>
                {profiles.map((profile) => (
                  <ListItem
                    key={profile.id}
                    testID={`market-widget-profile-${profile.id}`}
                    title={profile.name}
                    subtitle={[
                      profile.kind === 'single'
                        ? copy.singleCoin
                        : copy.marketList,
                      profile.source === 'hot'
                        ? copy.hotCoins
                        : intl.formatMessage({
                            id: ETranslations.global_watchlist,
                          }),
                      profile.kind === 'single' && profile.asset
                        ? getMarketWidgetAssetTitle(profile.asset)
                        : undefined,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    renderAvatar={
                      profile.kind === 'single' ? (
                        <Token
                          size="lg"
                          tokenImageUri={profile.asset?.logoURL}
                        />
                      ) : undefined
                    }
                    icon={
                      profile.kind === 'list' ? 'Layout3RowsOutline' : undefined
                    }
                    drillIn
                    onPress={() =>
                      navigation.push(EModalMarketRoutes.MarketWidgetEditor, {
                        profileId: profile.id,
                      })
                    }
                  />
                ))}
              </YStack>
            ) : (
              <Empty title={copy.noConfigurations} />
            )}
          </YStack>
        )}
      </Page.Body>
    </Page>
  );
}
