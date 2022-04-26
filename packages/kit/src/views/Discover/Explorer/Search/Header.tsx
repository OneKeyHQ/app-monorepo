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
import IconNoHistory from '@onekeyhq/kit/assets/3d_transaction_history.png';

import type { DAppItemType } from '../../type';

type HeaderHistoriesProps = {
  keyword: string;
  onSelectHistory?: (token: DAppItemType | string) => void;
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
            onPress={() => onSelectHistory?.(keyword)}
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
  onSelectHistory?: (history: DAppItemType | string) => void;
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
        autoFocus
        selectTextOnFocus
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
  return terms.length ? null : (
    <Box pt={12}>
      <Empty
        imageUrl={IconNoHistory}
        title={intl.formatMessage({
          id: 'title__no_history',
        })}
        subTitle={intl.formatMessage({
          id: 'title__no_history_desc',
        })}
      />
    </Box>
  );
};

export { Header, ListEmptyComponent };
