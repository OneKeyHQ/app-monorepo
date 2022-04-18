import React, { FC, useCallback, useMemo, useState } from 'react';

import { useFocusEffect, useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Box,
  Center,
  Divider,
  Empty,
  Icon,
  Image,
  Modal,
  Pressable,
  Searchbar,
  Spinner,
  Typography,
} from '@onekeyhq/components';
import { Text } from '@onekeyhq/components/src/Typography';
import { Token } from '@onekeyhq/engine/src/types/token';
import IconSearch from '@onekeyhq/kit/assets/3d_search.png';
import {
  ModalRoutes,
  RootRoutes,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';

import { formatNumber } from '../../../../components/Format';
import { useDebounce, useManageTokens } from '../../../../hooks';
import { useGeneral } from '../../../../hooks/redux';
import { SwapRoutes } from '../../typings';

import { useSearchTokens } from './hooks';

import type { ValuedToken } from '../../../../store/typings';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Root
>;

const isValidateAddr = (addr: string) => addr.length === 42;

type HeaderTokensProps = {
  tokens: ValuedToken[];
  showTop50Label?: boolean;
  onPress?: (token: ValuedToken) => void;
};

const HeaderTokens: FC<HeaderTokensProps> = ({
  tokens,
  showTop50Label,
  onPress,
}) => {
  const intl = useIntl();
  return (
    <Box>
      {tokens.length ? (
        <Box>
          <Typography.Subheading color="text-subdued">
            {intl.formatMessage({
              id: 'form__my_tokens',
              defaultMessage: 'MY TOKENS',
            })}
          </Typography.Subheading>
          <Box mt="2" mb="6">
            {tokens.map((item, index) => (
              <Pressable
                key={item.tokenIdOnNetwork}
                borderTopRadius={index === 0 ? '12' : undefined}
                borderBottomRadius={
                  index === tokens.length - 1 ? '12' : undefined
                }
                display="flex"
                flexDirection="row"
                justifyContent="space-between"
                p="4"
                alignItems="center"
                bg="surface-default"
                borderTopColor="divider"
                borderTopWidth={index !== 0 ? '1' : undefined}
                onPress={() => onPress?.(item)}
              >
                <Box display="flex" alignItems="center" flexDirection="row">
                  <Image
                    source={{ uri: item.logoURI }}
                    alt="logoURI"
                    size="8"
                    borderRadius="full"
                    fallbackElement={
                      <Center
                        w={8}
                        h={8}
                        rounded="full"
                        bgColor="surface-neutral-default"
                      >
                        <Icon size={20} name="QuestionMarkOutline" />
                      </Center>
                    }
                  />
                  <Box ml="3">
                    <Text
                      maxW={56}
                      numberOfLines={2}
                      typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                    >
                      {item.symbol}
                    </Text>
                    <Typography.Body2
                      maxW="56"
                      numberOfLines={1}
                      color="text-subdued"
                    >
                      {item.name}
                    </Typography.Body2>
                  </Box>
                </Box>
                <Box
                  display="flex"
                  flexDirection="column"
                  alignItems="flex-end"
                >
                  <Typography.Body2 numberOfLines={1} color="text-default">
                    {formatNumber(item?.balance ?? '0', { fixed: 6 })}
                  </Typography.Body2>
                  {/* <Typography.Body2 numberOfLines={1} color="text-subdued">
                    $
                    <FormatBalance
                      balance={item?.balance ?? '0'}
                      formatOptions={{ fixed: 6 }}
                    />
                  </Typography.Body2> */}
                </Box>
              </Pressable>
            ))}
          </Box>
        </Box>
      ) : null}
      {showTop50Label ? (
        <Typography.Subheading color="text-subdued" mb="2">
          {intl.formatMessage({
            id: 'form__top_50_tokens',
            defaultMessage: 'TOP 50 TOKENS',
          })}
        </Typography.Subheading>
      ) : null}
    </Box>
  );
};

type HeaderProps = {
  tokens: ValuedToken[];
  keyword: string;
  terms?: string;
  showTop50Label?: boolean;
  onChange: (keyword: string) => void;
  onPress?: (token: ValuedToken) => void;
};

const Header: FC<HeaderProps> = ({
  tokens,
  showTop50Label,
  keyword,
  terms,
  onChange,
  onPress,
}) => {
  const intl = useIntl();
  return (
    <Box>
      <Searchbar
        w="full"
        placeholder={intl.formatMessage({
          id: 'form__search_tokens',
          defaultMessage: 'Search Tokens',
        })}
        mb="6"
        value={keyword}
        onClear={() => onChange('')}
        onChangeText={(text) => onChange(text)}
      />
      {terms ? null : (
        <HeaderTokens
          tokens={tokens}
          showTop50Label={showTop50Label}
          onPress={onPress}
        />
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
  const navigation = useNavigation<NavigationProps>();
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
      subTitle={intl.formatMessage({
        id: 'content__no_results_desc',
        defaultMessage: 'The token you searched for was not found',
      })}
      actionTitle={intl.formatMessage({
        id: 'action__add_custom_tokens',
        defaultMessage: 'Add Custom Token',
      })}
      handleAction={() => {
        const params: { address?: string } = {};
        if (isValidateAddr(terms)) {
          params.address = terms;
        }
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Swap,
          params: {
            screen: SwapRoutes.CustomToken,
            params,
          },
        });
      }}
    />
  ) : null;
};

type ListingTokenProps = {
  item: ValuedToken;
  borderTopRadius?: string;
  borderBottomRadius?: string;
  onPress?: (item: ValuedToken) => void;
  balance?: string;
};

const ListingToken: FC<ListingTokenProps> = ({
  item,
  borderTopRadius,
  borderBottomRadius,
  onPress,
  balance,
}) => (
  <Pressable
    borderTopRadius={borderTopRadius}
    borderBottomRadius={borderBottomRadius}
    display="flex"
    flexDirection="row"
    justifyContent="space-between"
    p={4}
    alignItems="center"
    bg="surface-default"
    overflow="hidden"
    key={item.tokenIdOnNetwork}
    onPress={() => onPress?.(item)}
  >
    <Box display="flex" alignItems="center" flexDirection="row">
      <Image
        source={{ uri: item.logoURI }}
        alt="logoURI"
        size="8"
        borderRadius="full"
        fallbackElement={
          <Center w={8} h={8} rounded="full" bgColor="surface-neutral-default">
            <Icon size={20} name="QuestionMarkOutline" />
          </Center>
        }
      />
      <Box ml="3">
        <Text
          typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
          maxW="56"
          numberOfLines={2}
          color={item.balance ? 'text-disabled' : 'text-default'}
        >
          {item.symbol}
        </Text>
        <Typography.Body2
          numberOfLines={1}
          color={item.balance ? 'text-disabled' : 'text-subdued'}
        >
          {item.name}
        </Typography.Body2>
      </Box>
    </Box>
    <Box display="flex" flexDirection="column" alignItems="flex-end">
      <Typography.Body2 numberOfLines={1} color="text-default">
        {formatNumber(balance ?? '0', { fixed: 6 })}
      </Typography.Body2>
      {/* <Typography.Body2 numberOfLines={1} color="text-subdued">
        $
        <FormatBalance
          balance={item?.balance ?? '0'}
          formatOptions={{ fixed: 6 }}
        />
      </Typography.Body2> */}
    </Box>
  </Pressable>
);

type ListingProps = {
  onPress?: (token: ValuedToken) => void;
  excluded?: ValuedToken;
};

export const Listing: FC<ListingProps> = ({ onPress, excluded }) => {
  const intl = useIntl();
  const {
    accountTokens,
    allTokens,
    updateTokens,
    updateAccountTokens,
    balances,
  } = useManageTokens();
  const [keyword, setKeyword] = useState<string>('');

  const searchTerm = useDebounce(keyword, 1000);

  const { activeAccountId, activeNetworkId } = useGeneral();
  const { loading, searchedTokens } = useSearchTokens(
    searchTerm,
    keyword,
    activeNetworkId,
    activeAccountId,
  );

  useFocusEffect(updateTokens);
  useFocusEffect(updateAccountTokens);

  const headerTokens = useMemo(
    () =>
      accountTokens.filter(
        (i) => i.tokenIdOnNetwork !== excluded?.tokenIdOnNetwork,
      ),
    [accountTokens, excluded],
  );

  const flatListData = useMemo(() => {
    const tokens = searchTerm ? searchedTokens : allTokens;
    return tokens.filter(
      (i) => i.tokenIdOnNetwork !== excluded?.tokenIdOnNetwork,
    );
  }, [searchTerm, searchedTokens, allTokens, excluded]);

  const renderItem: ListRenderItem<ValuedToken> = useCallback(
    ({ item, index }) => (
      <ListingToken
        item={item}
        onPress={onPress}
        borderTopRadius={index === 0 ? '12' : undefined}
        borderBottomRadius={
          index === flatListData.length - 1 ? '12' : undefined
        }
        balance={balances[item.tokenIdOnNetwork]}
      />
    ),
    [flatListData.length, onPress, balances],
  );

  return (
    <>
      <Modal
        header={intl.formatMessage({ id: 'title__select_a_token' })}
        height="560px"
        footer={null}
        hidePrimaryAction
        flatListProps={{
          data: flatListData,
          // @ts-ignore
          renderItem,
          ItemSeparatorComponent: () => <Divider />,
          keyExtractor: (item) => (item as Token).tokenIdOnNetwork,
          showsVerticalScrollIndicator: false,
          ListEmptyComponent: (
            <ListEmptyComponent isLoading={loading} terms={searchTerm} />
          ),
          ListHeaderComponent: (
            <Header
              showTop50Label={allTokens.length > 0}
              tokens={headerTokens}
              keyword={keyword}
              terms={searchTerm}
              onChange={(text) => setKeyword(text)}
              onPress={onPress}
            />
          ),
        }}
      />
    </>
  );
};

export default Listing;
