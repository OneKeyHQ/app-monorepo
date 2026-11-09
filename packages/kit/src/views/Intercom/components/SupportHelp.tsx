import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import { useIntl } from 'react-intl';
import { FlatList } from 'react-native';

import {
  Empty,
  Icon,
  Input,
  Page,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IModalNavigationProp } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useIntercomUnreadCount } from '@onekeyhq/kit/src/hooks/useIntercomUnreadCount';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  parseIntercomArticleSearch,
  parseIntercomHome,
} from '@onekeyhq/shared/src/modules3rdParty/intercom/messengerModels';
import type {
  IIntercomArticleLink,
  IIntercomMessengerSession,
  IIntercomSupportRoute,
} from '@onekeyhq/shared/src/modules3rdParty/intercom/messengerTypes';
import { EIntercomRoutes } from '@onekeyhq/shared/src/routes/intercom';
import type { IIntercomParamList } from '@onekeyhq/shared/src/routes/intercom';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { useSupportResource } from '../hooks/useSupportResource';

import { SupportNavigation } from './SupportNavigation';

export function SupportHelp({
  session,
  active,
  route,
  sessionError,
}: {
  session?: IIntercomMessengerSession;
  active: boolean;
  route: IIntercomSupportRoute;
  sessionError?: () => void;
}) {
  const intl = useIntl();
  const navigation =
    useAppNavigation<IModalNavigationProp<IIntercomParamList>>();
  const unread = useIntercomUnreadCount();
  const [input, setInput] = useState('');
  const [phrase, setPhrase] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setPhrase(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);
  const loadHome = useCallback(async () => {
    if (!session) throw new OneKeyLocalError('Support session is unavailable');
    return parseIntercomHome(await session.request('home'));
  }, [session]);
  const home = useSupportResource(loadHome, active);
  const loadSearch = useCallback(async () => {
    if (!session) throw new OneKeyLocalError('Support session is unavailable');
    return parseIntercomArticleSearch(
      await session.request('articles/search', { phrase }),
    );
  }, [session, phrase]);
  const search = useSupportResource(loadSearch, active && !!phrase);
  const isSearching = !!input.trim();
  const waiting = input.trim() !== phrase;
  const loading = isSearching ? waiting || search.loading : home.loading;
  const failed = !!sessionError || (isSearching ? search.failed : home.failed);
  let articles: IIntercomArticleLink[] = [];
  if (!failed && !waiting)
    articles = isSearching ? (search.data ?? []) : (home.data?.articles ?? []);
  let emptyState: ReactElement | undefined;
  if (failed) {
    emptyState = (
      <Empty
        title={intl.formatMessage({
          id: ETranslations.global_connet_error_try_again,
        })}
        buttonProps={{
          testID: 'support-help-retry',
          children: intl.formatMessage({ id: ETranslations.global_retry }),
          onPress:
            sessionError || (isSearching ? search.refresh : home.refresh),
        }}
      />
    );
  } else if (!loading) {
    emptyState = (
      <Empty
        title={intl.formatMessage({
          id: ETranslations.global_search_no_results_title,
        })}
      />
    );
  }
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.settings_help_center })}
      />
      <Page.Body>
        <YStack px="$5" py="$3">
          <Input
            testID="support-help-search-input"
            leftIconName="SearchOutline"
            value={input}
            onChangeText={setInput}
            placeholder={intl.formatMessage({
              id: ETranslations.global_search,
            })}
            accessibilityLabel={intl.formatMessage({
              id: ETranslations.global_search,
            })}
            autoCapitalize="none"
            returnKeyType="search"
            autoCorrect={false}
            allowClear
          />
        </YStack>
        <FlatList
          testID="support-help-results"
          data={articles}
          keyExtractor={(article) => article.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          ListHeaderComponent={loading ? <Spinner /> : undefined}
          ListEmptyComponent={emptyState}
          renderItem={({ item }) => (
            <XStack
              testID={`support-help-result-${item.id}`}
              role="button"
              py="$4"
              gap="$3"
              alignItems="center"
              borderBottomWidth={1}
              borderBottomColor="$borderSubdued"
              hoverStyle={{ bg: '$bgHover' }}
              pressStyle={{ bg: '$bgActive' }}
              onPress={() => openUrlExternal(item.url)}
            >
              <YStack flex={1} gap="$1">
                <SizableText size="$bodyLgMedium">{item.title}</SizableText>
                {item.summary ? (
                  <SizableText
                    size="$bodyMd"
                    color="$textSubdued"
                    numberOfLines={2}
                  >
                    {item.summary}
                  </SizableText>
                ) : null}
              </YStack>
              <Icon name="ChevronRightOutline" size="$5" />
            </XStack>
          )}
        />
      </Page.Body>
      <Page.Footer>
        <SupportNavigation
          home
          unread={unread}
          homeLabel={home.data?.homeLabel}
          messagesLabel={home.data?.messagesLabel}
          onHome={navigation.pop}
          onMessages={() => navigation.replace(EIntercomRoutes.Messages, route)}
        />
      </Page.Footer>
    </Page>
  );
}
