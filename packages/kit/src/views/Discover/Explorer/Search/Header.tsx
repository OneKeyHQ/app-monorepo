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
  histories: HistoryItem[];
  onSelectHistory?: (token: HistoryItem) => void;
};

const HeaderHistories: FC<HeaderHistoriesProps> = ({
  histories,
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
      {histories.length ? (
        <Container.Box mb={4}>
          {histories.map((item, index) => (
            <Container.Item
              key={index}
              title={item.url}
              titleColor="text-default"
              customArrowIconName="ArrowCircleRightSolid"
              onPress={() => onSelectHistory?.(item)}
            />
          ))}
        </Container.Box>
      ) : null}
    </Box>
  );
};

type HeaderProps = {
  histories: HistoryItem[];
  keyword: string;
  terms?: string;
  onChange: (keyword: string) => void;
  onSelectHistory?: (history: HistoryItem) => void;
  onSubmitContent?: (content: string) => void;
};

const Header: FC<HeaderProps> = ({
  histories,
  keyword,
  terms,
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
        <HeaderHistories
          histories={histories}
          onSelectHistory={onSelectHistory}
        />
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
  return terms.length > 0 ? (
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
