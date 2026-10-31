import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigationState, usePreventRemove } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { FlatList } from 'react-native';

import {
  Alert,
  Empty,
  HeaderIconButton,
  Page,
  ScrollView,
  SearchBar,
  SegmentControl,
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
import marketWidget from '@onekeyhq/shared/src/modules/MarketWidget';
import type {
  IMarketWidgetAsset,
  IMarketWidgetKind,
  IMarketWidgetSource,
} from '@onekeyhq/shared/src/modules/MarketWidget/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  getMarketWidgetAssetKey,
  getMarketWidgetAssetSearchText,
  getMarketWidgetAssetSubtitle,
  getMarketWidgetAssetTitle,
  getMarketWidgetDisplayAsset,
  isMarketWidgetManualAssetAvailable,
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
  const {
    profileId: routeProfileId,
    kind: routeKind,
    editorSession,
  } = route.params;
  const editor = useMarketWidgetEditorState(editorSession);
  const initializedRef = useRef(false);
  const finishedRef = useRef(false);
  const [kind, setKind] = useState<IMarketWidgetKind>(routeKind ?? 'single');
  const [source, setSource] = useState<IMarketWidgetSource>('hot');
  const [slots, setSlots] = useState<(IMarketWidgetAsset | undefined)[]>([]);
  const [activeSlot, setActiveSlot] = useState<number>();
  const isPickingAsset = activeSlot !== undefined;
  const [query, setQuery] = useState('');
  const [saveError, setSaveError] = useState<string>();
  const legacyKind = editor.state?.profiles.find(
    (item) => item.id === routeProfileId,
  )?.kind;
  const settings = editorSession
    ? editor.state?.settings?.[0]
    : editor.state?.settings?.find(
        (item) => item.kind === (routeKind ?? legacyKind ?? 'single'),
      );

  useEffect(() => {
    if (initializedRef.current || !editor.state) return;
    const nextKind = settings?.kind ?? routeKind ?? legacyKind ?? 'single';
    const nextSource = settings?.source ?? 'hot';
    const initial =
      settings?.assets ??
      (nextKind === 'single' && settings?.asset
        ? [settings.asset]
        : editor.state[nextSource]);
    setKind(nextKind);
    setSource(nextSource);
    setSlots(
      Array.from(
        { length: nextKind === 'single' ? 1 : 3 },
        (_, index) => initial[index],
      ),
    );
    initializedRef.current = true;
  }, [editor.state, legacyKind, settings, routeKind]);

  useEffect(() => {
    if (!editor.privacyMasked) return;
    setSlots([]);
    setQuery('');
    setActiveSlot(undefined);
    initializedRef.current = false;
  }, [editor.privacyMasked]);

  useEffect(
    () => () => {
      if (editorSession && !finishedRef.current) {
        finishedRef.current = true;
        void marketWidget
          .finishEditing?.(editorSession, false)
          .catch(() => undefined);
      }
    },
    [editorSession],
  );

  const closeEditor = useCallback(
    (saved: boolean, pop = navigation.pop) => {
      finishedRef.current = true;
      pop();
      if (editorSession) {
        void marketWidget.finishEditing?.(editorSession, saved).catch(() => {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.global_unknown_error_retry_message,
            }),
          });
        });
      }
    },
    [editorSession, intl, navigation],
  );
  const displaySlots = useMemo(
    () =>
      slots.map((asset) =>
        getMarketWidgetDisplayAsset({
          asset,
          state: editor.state,
          source,
          kind,
        }),
      ),
    [slots, editor.state, source, kind],
  );
  const slotsValid =
    slots.length === (kind === 'single' ? 1 : 3) &&
    slots.every(
      (asset) =>
        !!editor.state &&
        isMarketWidgetManualAssetAvailable({
          state: editor.state,
          asset,
          kind,
        }),
    );
  const visibleAssets = useMemo(() => {
    const search = query.trim().toLowerCase();
    return (editor.state?.[source] ?? []).filter(
      (item) =>
        !search || getMarketWidgetAssetSearchText(item).includes(search),
    );
  }, [editor.state, query, source]);

  const closePicker = useCallback(() => {
    setActiveSlot(undefined);
    setQuery('');
  }, []);
  usePreventRemove(isPickingAsset, closePicker);
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
        onPress={isPickingAsset ? closePicker : () => closeEditor(false)}
      />
    ),
    [closeEditor, closePicker, hasPreviousPage, isPickingAsset],
  );
  const buildNativeHeaderLeftItems = useCallback(
    () => [glassBarItem(headerLeft())],
    [headerLeft],
  );

  const { isSaving, save: handleSave } = useMarketWidgetProfileSave({
    editor,
    editorSession,
    validate: async () => slotsValid,
    getInput: () => ({
      kind,
      name: (kind === 'single' ? copy.singleCoin : copy.marketList).slice(
        0,
        40,
      ),
      source,
      asset: kind === 'single' ? slots[0] : undefined,
      assets: slots.filter((item): item is IMarketWidgetAsset => !!item),
    }),
    onSaved: () => {
      Toast.success({
        title: intl.formatMessage({ id: ETranslations.feedback_change_saved }),
      });
      closeEditor(true);
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

  const isReady = !!editor.state && !editor.privacyMasked;
  const showFooter = isReady && !isPickingAsset;
  let title = kind === 'single' ? copy.singleCoin : copy.marketList;
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
          <MarketWidgetStateView {...editor} onRetry={editor.refresh} />
        ) : null}
        {isReady && isPickingAsset ? (
          <YStack flex={1}>
            <YStack px="$5" pb="$3" gap="$3">
              <SegmentControl
                value={source}
                onChange={(value) => setSource(value as IMarketWidgetSource)}
                options={[
                  { label: copy.watchlist, value: 'watchlist' },
                  { label: copy.hotCoins, value: 'hot' },
                ]}
              />
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
                    !!slots[activeSlot] &&
                    getMarketWidgetAssetKey(slots[activeSlot]) ===
                      getMarketWidgetAssetKey(item)
                  }
                  onPress={() => {
                    setSlots((previous) =>
                      previous.map((value, index) =>
                        index === activeSlot ? item : value,
                      ),
                    );
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
            {displaySlots.map((asset, index) => (
              <YStack key={index} gap="$2">
                <SizableText size="$bodyMdMedium">
                  {kind === 'single'
                    ? copy.coin
                    : `${copy.coin} ${intl.formatNumber(index + 1)}`}
                </SizableText>
                <ListItem
                  testID={
                    kind === 'single'
                      ? 'market-widget-choose-coin'
                      : `market-widget-choose-coin-${index + 1}`
                  }
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
                  onPress={() => setActiveSlot(index)}
                />
              </YStack>
            ))}
            {saveError ? (
              <Alert type="critical" description={saveError} />
            ) : null}
          </ScrollView>
        ) : null}
      </Page.Body>
      <Page.Footer
        disableKeyboardAnimation={!showFooter}
        onCancel={(pop) => closeEditor(false, pop)}
        onConfirm={handleSave}
        onConfirmText={intl.formatMessage({ id: ETranslations.action_save })}
        confirmButtonProps={{
          testID: 'market-widget-save',
          loading: isSaving,
          disabled: !showFooter || isSaving || !slotsValid,
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
