import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Container,
  Empty,
  Searchbar,
  Spinner,
  Typography,
} from '@onekeyhq/components';
import IconSearch from '@onekeyhq/kit/assets/3d_search.png';

import type { HistoryItem } from './types';

type HeaderHistoriesProps = {
  keyword: string;
  onSelectHistory?: (token: HistoryItem) => void;
};

const HeaderHistories: FC<HeaderHistoriesProps> = ({
  keyword,
  onSelectHistory,
}) => {
  const intl = useIntl();
  return (
    <Box>
      <Typography.Subheading mb="2" color="text-subdued">
        {intl.formatMessage({
          id: 'title__search_results',
        })}
      </Typography.Subheading>
      {keyword ? (
        <Container.Box mb={4}>
          <Container.Item
            key="search-content"
            title={keyword}
            titleColor="text-default"
            customArrowIconName="ArrowCircleRightSolid"
            onPress={() =>
              onSelectHistory?.({ url: keyword, title: '', logoURI: '' })
            }
          />
        </Container.Box>
      ) : null}
    </Box>
  );
};

type HeaderProps = {
  terms: string;
  keyword: string;
  onChange: (keyword: string) => void;
  onSelectHistory?: (history: HistoryItem) => void;
  onSubmitContent?: (content: string) => void;
};

const Header: FC<HeaderProps> = ({
  terms,
  keyword,
  onChange,
  onSelectHistory,
  onSubmitContent,
}) => {
  const intl = useIntl();
  return (
    <Box>
      <Searchbar
        w="full"
        placeholder={intl.formatMessage({
          id: 'content__search_or_enter_dapp_url',
          defaultMessage: 'Search Tokens',
        })}
        mb="6"
        value={keyword}
        onClear={() => onChange('')}
        onChangeText={(text) => onChange(text)}
        onSubmitEditing={(event) => {
          onSubmitContent?.(event.nativeEvent.text);
        }}
      />
      {terms ? (
        <HeaderHistories keyword={keyword} onSelectHistory={onSelectHistory} />
      ) : (
        <Typography.Subheading mb={2} color="text-subdued">
          {intl.formatMessage({ id: 'transaction__history' })}
        </Typography.Subheading>
      )}
    </Box>
  );
};

type ListEmptyComponentProps = {
  isLoading: boolean;
  terms: string;
};

const ListEmptyComponent: FC<ListEmptyComponentProps> = ({
  isLoading,
  terms,
}) => {
  const intl = useIntl();
  if (isLoading) {
    return (
      <Center w="full" h="20">
        <Spinner size="lg" />
      </Center>
    );
  }
  return terms.length ? (
    <Empty
      imageUrl={IconSearch}
      title={intl.formatMessage({
        id: 'content__no_results',
        defaultMessage: 'No Result',
      })}
    />
  ) : null;
};

export { Header, ListEmptyComponent };
