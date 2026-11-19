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
  Skeleton,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IModalNavigationProp } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useIntercomUnreadCount } from '@onekeyhq/kit/src/hooks/useIntercomUnreadCount';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IIntercomArticleLink,
  IIntercomMessengerSession,
} from '@onekeyhq/shared/src/modules3rdParty/intercom/messengerTypes';
import { EIntercomRoutes } from '@onekeyhq/shared/src/routes/intercom';
import type {
  IIntercomParamList,
  IIntercomSupportRoute,
} from '@onekeyhq/shared/src/routes/intercom';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { SupportNavigation } from '../components/SupportNavigation';
import { SupportSessionBoundary } from '../components/SupportSessionBoundary';
import { useSupportResource } from '../hooks/useSupportResource';

// Stable empty list: FlatList treats a new array as changed data.
const NO_ARTICLES: IIntercomArticleLink[] = [];
const ARTICLE_PLACEHOLDER_WIDTHS = ['80%', '60%', '70%', '50%'] as const;

function SupportHelpContent({
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
    return session.getHome();
  }, [session]);
  const home = useSupportResource(loadHome, active);
  const loadSearch = useCallback(async () => {
    if (!session) throw new OneKeyLocalError('Support session is unavailable');
    return session.searchArticles(phrase);
  }, [session, phrase]);
  const search = useSupportResource(loadSearch, active && !!phrase);
  const isSearching = !!input.trim();
  const waiting = input.trim() !== phrase;
  // Placeholders cover only the first answer; later retries keep the screen.
  const homeLoading = !sessionError && !home.settled;
  const showSkeleton = homeLoading && !isSearching;
  const loading = isSearching ? waiting || search.loading : home.loading;
  const failed = !!sessionError || (isSearching ? search.failed : home.failed);
  let articles = NO_ARTICLES;
  if (!failed && !waiting)
    articles = (isSearching ? search.data : home.data?.articles) ?? NO_ARTICLES;
  let emptyState: ReactElement | undefined;
  if (showSkeleton) {
    emptyState = (
      <YStack testID="support-help-skeleton">
        {/* Same box as a result row. */}
        {ARTICLE_PLACEHOLDER_WIDTHS.map((width) => (
          <YStack
            key={width}
            minHeight="$11"
            justifyContent="center"
            mx="$2"
            px="$3"
            py="$2"
          >
            <Skeleton.BodyLg w={width} />
          </YStack>
        ))}
      </YStack>
    );
  } else if (failed) {
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
          contentContainerStyle={{ paddingBottom: 20 }}
          ListHeaderComponent={
            loading && !showSkeleton ? <Spinner /> : undefined
          }
          ListEmptyComponent={emptyState}
          renderItem={({ item }) => (
            // Standard list-row spacing, so the highlight pads the text. The
            // row keeps its own button role, which ListItem does not declare.
            <XStack
              testID={`support-help-result-${item.id}`}
              role="button"
              minHeight="$11"
              mx="$2"
              px="$3"
              py="$2"
              gap="$3"
              alignItems="center"
              borderRadius="$3"
              borderCurve="continuous"
              {...listItemPressStyle}
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
              <Icon
                name="ChevronRightSmallOutline"
                color="$iconSubdued"
                flexShrink={0}
              />
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
          loading={homeLoading}
          onHome={navigation.pop}
          onMessages={() => navigation.replace(EIntercomRoutes.Messages, route)}
        />
      </Page.Footer>
    </Page>
  );
}

export default function SupportHelp() {
  return (
    <SupportSessionBoundary>
      {(props) => <SupportHelpContent {...props} />}
    </SupportSessionBoundary>
  );
}
