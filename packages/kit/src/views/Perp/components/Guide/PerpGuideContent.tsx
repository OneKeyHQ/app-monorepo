import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  Icon,
  ScrollView,
  SearchBar,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { HELP_CENTER_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PERP_GUIDE_CATEGORIES, openGuideUrl } from './perpGuideData';

import type { IPerpGuideArticle, IPerpGuideCategory } from './perpGuideData';

function GuideArticleItem({
  article,
  onNavigate,
}: {
  article: IPerpGuideArticle;
  onNavigate?: () => void;
}) {
  const intl = useIntl();
  const url = useHelpLink({ path: `articles/${article.articleId}` });
  const handlePress = useCallback(() => {
    if (onNavigate) {
      onNavigate();
      setTimeout(() => {
        openGuideUrl(url);
      }, 150);
    } else {
      openGuideUrl(url);
    }
  }, [url, onNavigate]);

  return (
    <XStack
      onPress={handlePress}
      px="$3"
      py="$2.5"
      alignItems="center"
      gap="$3"
      cursor="default"
      borderRadius="$2"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      role="link"
      accessibilityLabel={intl.formatMessage({ id: article.titleId })}
    >
      <YStack flex={1} gap="$0.5">
        <SizableText size="$bodyMdMedium" color="$text">
          {intl.formatMessage({ id: article.titleId })}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
          {intl.formatMessage({ id: article.descriptionId })}
        </SizableText>
      </YStack>
      <Icon
        name="ChevronRightSmallOutline"
        size="$4"
        color="$iconSubdued"
        flexShrink={0}
      />
    </XStack>
  );
}

function GuideCategorySection({
  category,
  isLast,
  onNavigate,
}: {
  category: IPerpGuideCategory;
  isLast: boolean;
  onNavigate?: () => void;
}) {
  const intl = useIntl();
  return (
    <YStack>
      <SizableText size="$bodySm" color="$textSubdued" px="$3" pt="$4" pb="$1">
        {intl.formatMessage({ id: category.titleId })}
      </SizableText>
      <YStack>
        {category.articles.map((article) => (
          <GuideArticleItem
            key={article.articleId}
            article={article}
            onNavigate={onNavigate}
          />
        ))}
      </YStack>
      {isLast ? null : <Divider mx="$3" mt="$1" />}
    </YStack>
  );
}

export function PerpGuideContent({ onClose }: { onClose?: () => void }) {
  const intl = useIntl();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = useCallback(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    const url = `${HELP_CENTER_URL}?q=${encodeURIComponent(trimmed)}`;
    if (onClose) {
      onClose();
      setTimeout(() => {
        openGuideUrl(url);
      }, 150);
    } else {
      openGuideUrl(url);
    }
  }, [searchQuery, onClose]);

  return (
    <YStack flex={1}>
      <YStack px="$3" pt="$2" pb="$1">
        <SearchBar
          placeholder={intl.formatMessage({
            id: ETranslations.perp_guide_search_placeholder,
          })}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearchSubmit}
        />
      </YStack>
      <ScrollView flex={1}>
        {PERP_GUIDE_CATEGORIES.map((category, index) => (
          <GuideCategorySection
            key={category.titleId}
            category={category}
            isLast={index === PERP_GUIDE_CATEGORIES.length - 1}
            onNavigate={onClose}
          />
        ))}
        <YStack h="$2" />
      </ScrollView>
    </YStack>
  );
}
