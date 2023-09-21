import type { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Empty,
  Icon,
  Searchbar,
  Spinner,
  Text,
  Typography,
} from '@onekeyhq/components';
import Pressable from '@onekeyhq/components/src/Pressable/Pressable';

import type { MatchDAppItemType } from '../explorerUtils';

type HeaderHistoriesProps = {
  keyword: string;
  onSelectHistory?: (token: MatchDAppItemType | string) => void;
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
      {keyword && (
        <Pressable
          flexDirection="row"
          alignItems="center"
          bg="surface-default"
          borderRadius={12}
          px={{ base: '4', lg: '6' }}
          py="4"
          mb="4"
          onPress={() => onSelectHistory?.(keyword)}
        >
          <Box flex="1" mr="4">
            <Text
              color="text-default"
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            >
              {keyword}
            </Text>
          </Box>
          <Icon name="ArrowCircleRightMini" />
        </Pressable>
      )}
    </Box>
  );
};

type HeaderProps = {
  keyword: string;
  onChange: (keyword: string) => void;
  onSelectHistory?: (history: MatchDAppItemType | string) => void;
  onSubmitContent?: (content: string) => void;
};

const Header: FC<HeaderProps> = ({
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
          id: 'content__search_dapps_or_type_url',
        })}
        mb="6"
        autoFocus
        selectTextOnFocus
        value={keyword}
        keyboardType="url"
        onClear={() => onChange('')}
        onChangeText={(text) => onChange(text)}
        onSubmitEditing={(event) => {
          onSubmitContent?.(event.nativeEvent.text);
        }}
        returnKeyType="go"
      />
      {keyword ? (
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
        emoji="🕐"
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
