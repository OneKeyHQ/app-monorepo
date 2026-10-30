import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigationState } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { FlatList } from 'react-native';

import {
  Alert,
  Empty,
  HeaderIconButton,
  Page,
  ScrollView,
  SearchBar,
  Select,
  SizableText,
  Toast,
  YStack,
  glassBarItem,
} from '@onekeyhq/components';
import type { IModalNavigationProp } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IMarketWidgetAsset,
  IMarketWidgetKind,
  IMarketWidgetSource,
} from '@onekeyhq/shared/src/modules/MarketWidget/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  containsMarketWidgetAsset,
  getMarketWidgetAssetKey,
  getMarketWidgetAssetSearchText,
  getMarketWidgetAssetSubtitle,
  getMarketWidgetAssetTitle,
  getMarketWidgetProfileTitle,
  isMarketWidgetAssetAvailable,
} from './assetIdentity';
import { MarketWidgetStateView } from './MarketWidgetStateView';
import { useMarketWidgetCopy } from './useMarketWidgetCopy';
import { useMarketWidgetEditorState } from './useMarketWidgetEditorState';
import { useMarketWidgetProfileSave } from './useMarketWidgetProfileSave';

import type {
  EModalMarketRoutes,
  IModalMarketParamList,
} from '../router/types';

export default function MarketWidgetEditor() {
  const intl = useIntl();
  const copy = useMarketWidgetCopy();
  const navigation =
    useAppNavigation<IModalNavigationProp<IModalMarketParamList>>();
  const hasPreviousPage = useNavigationState((state) => state.index > 0);
  const route = useAppRoute<
    IModalMarketParamList,
    EModalMarketRoutes.MarketWidgetEditor
  >();
  const { profileId: routeProfileId, kind: routeKind } = route.params;
  const [persistedProfileId, setPersistedProfileId] = useState<string>();
  const profileId = routeProfileId ?? persistedProfileId;
  const editor = useMarketWidgetEditorState();
  const initializedRef = useRef(false);
  const [kind, setKind] = useState<IMarketWidgetKind>(routeKind ?? 'single');
  const [source, setSource] = useState<IMarketWidgetSource>('hot');
  const [asset, setAsset] = useState<IMarketWidgetAsset>();
  const [isPickingAsset, setIsPickingAsset] = useState(false);
  const [query, setQuery] = useState('');
  const [saveError, setSaveError] = useState<string>();
  const profile = editor.state?.profiles.find((item) => item.id === profileId);
  const missingProfile = !!profileId && !!editor.state && !profile;

  useEffect(() => {
    if (initializedRef.current || !editor.state || missingProfile) return;
    const nextKind = profile?.kind ?? routeKind ?? 'single';
    setKind(nextKind);
    setSource(profile?.source ?? 'hot');
    setAsset(
      profile?.asset ??
        (nextKind === 'single' ? editor.state.hot[0] : undefined),
    );
    initializedRef.current = true;
  }, [editor.state, missingProfile, profile, routeKind]);

  useEffect(() => {
    if (!editor.privacyMasked) return;
    setAsset(undefined);
    setQuery('');
    setIsPickingAsset(false);
    initializedRef.current = false;
  }, [editor.privacyMasked]);

  const sourceAssets = editor.state?.[source] ?? [];
  const assetRemoved =
    kind === 'single' &&
    !!asset &&
    !!editor.state &&
    !isMarketWidgetAssetAvailable({
      state: editor.state,
      source,
      asset,
      profileId,
    });
  const visibleAssets = useMemo(() => {
    const assets = editor.state?.[source] ?? [];
    const available =
      source === 'hot' &&
      asset &&
      !assetRemoved &&
      !containsMarketWidgetAsset(assets, asset)
        ? [asset, ...assets]
        : assets;
    const search = query.trim().toLowerCase();
    return available.filter(
      (item) =>
        !search || getMarketWidgetAssetSearchText(item).includes(search),
    );
  }, [asset, assetRemoved, editor.state, query, source]);

  const handleSourceChange = useCallback(
    (next: IMarketWidgetSource) => {
      if (next === source) return;
      setSource(next);
      setSaveError(undefined);
      if (!containsMarketWidgetAsset(editor.state?.[next] ?? [], asset)) {
        setAsset(undefined);
      }
    },
    [asset, editor.state, source],
  );

  const closePicker = useCallback(() => {
    setIsPickingAsset(false);
    setQuery('');
  }, []);
  const headerLeft = useCallback(
    () => (
      <HeaderIconButton
        testID={
          isPickingAsset
            ? 'market-widget-coin-back'
            : 'market-widget-editor-back'
        }
        icon={
          isPickingAsset || hasPreviousPage
            ? 'ChevronLeftOutline'
            : 'CrossedLargeOutline'
        }
        onPress={isPickingAsset ? closePicker : navigation.pop}
      />
    ),
    [closePicker, hasPreviousPage, isPickingAsset, navigation.pop],
  );
  const buildNativeHeaderLeftItems = useCallback(
    () => [glassBarItem(headerLeft())],
    [headerLeft],
  );

  const { isSaving, save: handleSave } = useMarketWidgetProfileSave({
    editor,
    validate: async () => true,
    getInput: () => {
      return {
        id: profileId,
        kind,
        name: getMarketWidgetProfileTitle({ kind, source, asset }, copy).slice(
          0,
          40,
        ),
        source,
        asset: kind === 'single' ? asset : undefined,
      };
    },
    onPersisted: (saved) => setPersistedProfileId(saved.id),
    onSaved: () => {
      Toast.success({
        title: intl.formatMessage({ id: ETranslations.feedback_change_saved }),
      });
      navigation.pop();
    },
    onError: (reason) => {
      if (!reason) setSaveError(undefined);
      else if (reason === 'unavailable') setSaveError(copy.assetUnavailable);
      else
        setSaveError(
          intl.formatMessage({
            id: ETranslations.global_unknown_error_retry_message,
          }),
        );
    },
  });

  const isReady = !!editor.state && !editor.privacyMasked && !missingProfile;
  const showFooter = isReady && !isPickingAsset;
  let title = profileId ? copy.editConfiguration : copy.newConfiguration;
  if (isPickingAsset) title = copy.coin;
  return (
    <Page scrollEnabled={false}>
      <Page.Header
        title={title}
        {...(platformEnv.isNativeIOS26Plus
          ? { unstable_headerLeftItems: buildNativeHeaderLeftItems }
          : { headerLeft })}
      />
      <Page.Body>
        {!isReady ? (
          <MarketWidgetStateView
            {...editor}
            unavailable={missingProfile}
            onRetry={editor.refresh}
          />
        ) : null}
        {isReady && isPickingAsset ? (
          <YStack flex={1}>
            <YStack px="$5" pb="$3">
              <SearchBar
                testID="market-widget-coin-search"
                placeholder={copy.searchCoins}
                value={query}
                onChangeText={setQuery}
              />
            </YStack>
            <FlatList
              data={visibleAssets}
              keyExtractor={getMarketWidgetAssetKey}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <ListItem
                  testID={`market-widget-coin-${getMarketWidgetAssetKey(item)}`}
                  renderAvatar={
                    <Token size="lg" tokenImageUri={item.logoURL} />
                  }
                  title={getMarketWidgetAssetTitle(item)}
                  subtitle={getMarketWidgetAssetSubtitle(item)}
                  checkMark={
                    !!asset &&
                    getMarketWidgetAssetKey(asset) ===
                      getMarketWidgetAssetKey(item)
                  }
                  onPress={() => {
                    setAsset(item);
                    setSaveError(undefined);
                    closePicker();
                  }}
                />
              )}
              ListEmptyComponent={
                <Empty
                  title={intl.formatMessage({
                    id: query
                      ? ETranslations.global_no_results
                      : ETranslations.empty_no_tokens_found,
                  })}
                  description={
                    query
                      ? intl.formatMessage({
                          id: ETranslations.global_search_no_results_desc,
                        })
                      : undefined
                  }
                />
              }
            />
          </YStack>
        ) : null}
        {isReady && !isPickingAsset ? (
          <ScrollView
            flex={1}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ px: '$5', gap: '$5', pb: '$5' }}
          >
            <YStack gap="$2">
              <SizableText size="$bodyMdMedium">{copy.source}</SizableText>
              <Select<IMarketWidgetSource>
                testID="market-widget-source"
                title={copy.source}
                value={source}
                disabled={isSaving}
                onChange={handleSourceChange}
                items={[
                  {
                    value: 'watchlist',
                    label: copy.watchlist,
                  },
                  { value: 'hot', label: copy.hotCoins },
                ]}
                defaultTriggerInputProps={{ size: 'large' }}
              />
            </YStack>
            {kind === 'single' ? (
              <YStack gap="$2">
                <SizableText size="$bodyMdMedium">{copy.coin}</SizableText>
                <ListItem
                  testID="market-widget-choose-coin"
                  mx="$0"
                  borderWidth="$px"
                  borderColor="$borderSubdued"
                  borderRadius="$3"
                  renderAvatar={
                    <Token size="lg" tokenImageUri={asset?.logoURL} />
                  }
                  title={
                    asset
                      ? getMarketWidgetAssetTitle(asset)
                      : intl.formatMessage({
                          id: ETranslations.global_select_crypto,
                        })
                  }
                  subtitle={
                    asset ? getMarketWidgetAssetSubtitle(asset) : undefined
                  }
                  drillIn
                  disabled={isSaving}
                  onPress={() => setIsPickingAsset(true)}
                />
                {assetRemoved ? (
                  <SizableText color="$textCritical" size="$bodySm">
                    {copy.assetUnavailable}
                  </SizableText>
                ) : null}
              </YStack>
            ) : (
              <YStack gap="$2">
                <SizableText size="$bodyMd" color="$textSubdued">
                  {copy.listDescription}
                </SizableText>
                {sourceAssets.slice(0, 3).map((item) => (
                  <ListItem
                    key={getMarketWidgetAssetKey(item)}
                    mx="$0"
                    renderAvatar={
                      <Token size="md" tokenImageUri={item.logoURL} />
                    }
                    title={getMarketWidgetAssetTitle(item)}
                    subtitle={getMarketWidgetAssetSubtitle(item)}
                  />
                ))}
                {!sourceAssets.length ? (
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.empty_no_tokens_found,
                    })}
                  </SizableText>
                ) : null}
              </YStack>
            )}
            {saveError ? (
              <Alert type="critical" description={saveError} />
            ) : null}
          </ScrollView>
        ) : null}
      </Page.Body>
      <Page.Footer
        disableKeyboardAnimation={!showFooter}
        onConfirm={handleSave}
        onConfirmText={intl.formatMessage({ id: ETranslations.action_save })}
        confirmButtonProps={{
          testID: 'market-widget-save',
          loading: isSaving,
          disabled:
            !showFooter ||
            isSaving ||
            (kind === 'single' && (!asset || assetRemoved)),
        }}
        cancelButtonProps={{
          testID: 'market-widget-cancel',
          disabled: isSaving,
        }}
      >
        {showFooter ? undefined : <YStack />}
      </Page.Footer>
    </Page>
  );
}
