import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  Icon,
  SearchBar,
  SizableText,
  YStack,
} from '@onekeyhq/components';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import {
  PERP_GUIDE_CATEGORIES,
  openGuideUrl,
} from '@onekeyhq/kit/src/views/Perp/components/Guide/perpGuideData';
import type { IPerpGuideArticle } from '@onekeyhq/kit/src/views/Perp/components/Guide/perpGuideData';
import { HELP_CENTER_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { WebAccountPanelListItem } from './atoms/WebAccountPanelListItem';
import { WebAccountPanelSectionTitle } from './atoms/WebAccountPanelSectionTitle';

export interface IWebAccountPanelArticlesProps {
  onRequestClose: () => void;
}

function ArticleRow({
  article,
  onRequestClose,
}: {
  article: IPerpGuideArticle;
  onRequestClose: () => void;
}) {
  const intl = useIntl();
  const url = useHelpLink({ path: `articles/${article.articleId}` });
  const handlePress = useCallback(() => {
    onRequestClose();
    setTimeout(() => {
      openGuideUrl(url);
    }, 150);
  }, [url, onRequestClose]);

  return (
    <WebAccountPanelListItem
      onPress={handlePress}
      testID={`web-account-panel-article-${article.articleId}`}
      renderLeft={
        <YStack gap="$0.5" w="100%">
          <SizableText size="$bodyMdMedium" color="$text" numberOfLines={1}>
            {intl.formatMessage({ id: article.titleId })}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {intl.formatMessage({ id: article.descriptionId })}
          </SizableText>
        </YStack>
      }
      renderRight={
        <Icon name="ArrowTopRightOutline" size="$5" color="$iconSubdued" />
      }
    />
  );
}

export function WebAccountPanelArticles({
  onRequestClose,
}: IWebAccountPanelArticlesProps) {
  const intl = useIntl();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = useCallback(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      return;
    }
    const url = `${HELP_CENTER_URL}?q=${encodeURIComponent(trimmed)}`;
    onRequestClose();
    setTimeout(() => {
      openGuideUrl(url);
    }, 150);
  }, [searchQuery, onRequestClose]);

  return (
    <YStack w="100%">
      <YStack pt="$5" px="$5" w="100%">
        <SearchBar
          size="small"
          testID="web-account-panel-articles-search"
          placeholder={intl.formatMessage({
            id: ETranslations.perp_guide_search_placeholder,
          })}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearchSubmit}
        />
      </YStack>
      {PERP_GUIDE_CATEGORIES.map((category, index) => (
        <YStack key={category.titleId} w="100%">
          {index > 0 ? <Divider borderColor="$neutral3" /> : null}
          <YStack py="$5" w="100%">
            <WebAccountPanelSectionTitle>
              {intl.formatMessage({ id: category.titleId })}
            </WebAccountPanelSectionTitle>
            {category.articles.map((article) => (
              <ArticleRow
                key={article.articleId}
                article={article}
                onRequestClose={onRequestClose}
              />
            ))}
          </YStack>
        </YStack>
      ))}
    </YStack>
  );
}
