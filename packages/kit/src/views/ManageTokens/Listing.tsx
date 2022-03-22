import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { useFocusEffect, useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Box,
  Center,
  Dialog,
  Divider,
  Empty,
  Icon,
  IconButton,
  Image,
  Modal,
  Pressable,
  Searchbar,
  Spinner,
  Typography,
  utils,
} from '@onekeyhq/components';
import { Text } from '@onekeyhq/components/src/Typography';
import { Token } from '@onekeyhq/engine/src/types/token';
import IconSearch from '@onekeyhq/kit/assets/3d_search.png';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { FormatBalance } from '../../components/Format';
import { useDebounce, useManageTokens, useToast } from '../../hooks';
import { useGeneral } from '../../hooks/redux';
import { timeout } from '../../utils/helper';

import { useSearchTokens } from './hooks';
import { ManageTokenRoutes, ManageTokenRoutesParams } from './types';

import type { ValuedToken } from '../../store/reducers/general';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  ManageTokenRoutesParams,
  ManageTokenRoutes.Listing
>;

const isValidateAddr = (addr: string) => addr.length === 42;

type HeaderTokensProps = {
  tokens: ValuedToken[];
  topTokens: Token[];
  onDelToken?: (token: Token) => void;
};

const HeaderTokens: FC<HeaderTokensProps> = ({
  tokens,
  topTokens,
  onDelToken,
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
              <Box
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
                      {item.symbol} ({item.name})
                    </Text>
                    <Typography.Body2
                      maxW="56"
                      numberOfLines={1}
                      color="text-subdued"
                    >
                      <FormatBalance
                        balance={item?.balance ?? '0'}
                        suffix={item.symbol}
                        formatOptions={{ fixed: 6 }}
                      />
                    </Typography.Body2>
                  </Box>
                </Box>
                <IconButton
                  name="TrashSolid"
                  type="plain"
                  circle
                  onPress={() => onDelToken?.(item)}
                />
              </Box>
            ))}
          </Box>
        </Box>
      ) : null}
      {topTokens.length ? (
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
  topTokens: Token[];
  tokens: ValuedToken[];
  keyword: string;
  terms?: string;
  onChange: (keyword: string) => void;
  onDelToken?: (token: Token) => void;
};

const Header: FC<HeaderProps> = ({
  tokens,
  topTokens,
  keyword,
  terms,
  onChange,
  onDelToken,
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
          onDelToken={onDelToken}
          topTokens={topTokens}
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
        navigation.navigate(ManageTokenRoutes.CustomToken, params);
      }}
    />
  ) : null;
};

type ListingTokenProps = {
  item: ValuedToken;
  isOwned?: boolean;
  borderTopRadius?: string;
  borderBottomRadius?: string;
};

const ListingToken: FC<ListingTokenProps> = ({
  item,
  borderTopRadius,
  borderBottomRadius,
  isOwned,
}) => {
  const navigation = useNavigation<NavigationProps>();
  const { activeAccount, activeNetwork } = useGeneral();
  const { text } = useToast();
  const { updateAccountTokens, updateTokens } = useManageTokens();
  const onPress = useCallback(async () => {
    if (activeAccount && activeNetwork) {
      try {
        await timeout(
          backgroundApiProxy.engine.quickAddToken(
            activeAccount?.id,
            activeNetwork.network.id,
            item.tokenIdOnNetwork,
          ),
          5000,
        );
      } catch (e) {
        text('msg__failed_to_add_token');
        return;
      }
      text('msg__token_added');
      updateAccountTokens();
      updateTokens();
    }
  }, [
    activeAccount,
    activeNetwork,
    text,
    updateAccountTokens,
    updateTokens,
    item.tokenIdOnNetwork,
  ]);
  const onDetail = useCallback(() => {
    const {
      name,
      symbol,
      tokenIdOnNetwork: address,
      decimals: decimal,
      logoURI,
    } = item;
    navigation.push(ManageTokenRoutes.AddToken, {
      name,
      symbol,
      address,
      decimal,
      logoURI,
    });
  }, [navigation, item]);
  return (
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
      onPress={onDetail}
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
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            maxW="56"
            numberOfLines={2}
            color={item.balance ? 'text-disabled' : 'text-default'}
          >
            {item.symbol}({item.name})
          </Text>
          <Typography.Body2
            numberOfLines={1}
            color={item.balance ? 'text-disabled' : 'text-subdued'}
          >
            {utils.shortenAddress(item.tokenIdOnNetwork)}
          </Typography.Body2>
        </Box>
      </Box>
      <Box>
        {isOwned ? (
          <Box p={2}>
            <Icon name="CheckSolid" color="interactive-disabled" />
          </Box>
        ) : (
          <IconButton
            name="PlusSolid"
            type="plain"
            circle
            p="4"
            onPromise={onPress}
          />
        )}
      </Box>
    </Pressable>
  );
};

export const Listing: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const {
    accountTokens,
    accountTokensMap,
    allTokens,
    updateTokens,
    updateAccountTokens,
  } = useManageTokens();
  const [keyword, setKeyword] = useState<string>('');
  const [mylist, setMylist] = useState<Token[]>([]);
  const searchTerm = useDebounce(keyword, 1000);

  const { activeNetwork, activeAccount } = useGeneral();
  const { loading, searchedTokens } = useSearchTokens(
    searchTerm,
    keyword,
    activeNetwork?.network.id,
  );

  const [visible, setVisible] = useState(false);
  const [toDeletedToken, setToDeletedToken] = useState<Token>();

  useEffect(() => {
    setMylist(accountTokens.filter((i) => i.tokenIdOnNetwork));
  }, [accountTokens]);

  const onToggleDeleteDialog = useCallback((token?: Token) => {
    if (token) {
      setToDeletedToken(token);
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, []);

  const onDelete = useCallback(async () => {
    if (activeAccount && toDeletedToken) {
      await backgroundApiProxy.engine.removeTokenFromAccount(
        activeAccount.id,
        toDeletedToken?.id,
      );
    }
    onToggleDeleteDialog(undefined);
    updateTokens();
    updateAccountTokens();
  }, [
    activeAccount,
    toDeletedToken,
    updateTokens,
    updateAccountTokens,
    onToggleDeleteDialog,
  ]);

  useFocusEffect(updateTokens);
  useFocusEffect(updateAccountTokens);

  const flatListData = useMemo(
    () => (searchTerm ? searchedTokens : allTokens),
    [searchTerm, searchedTokens, allTokens],
  );

  const renderItem: ListRenderItem<ValuedToken> = useCallback(
    ({ item, index }) => (
      <ListingToken
        item={item}
        borderTopRadius={index === 0 ? '12' : undefined}
        borderBottomRadius={
          index === flatListData.length - 1 ? '12' : undefined
        }
        isOwned={accountTokensMap.has(item.tokenIdOnNetwork)}
      />
    ),
    [flatListData.length, accountTokensMap],
  );

  return (
    <>
      <Modal
        header={intl.formatMessage({
          id: 'title__manage_tokens',
          defaultMessage: 'Manage Tokens',
        })}
        height="560px"
        headerDescription={activeNetwork?.network.shortName}
        hidePrimaryAction
        onSecondaryActionPress={() => {
          navigation.navigate(ManageTokenRoutes.CustomToken);
        }}
        secondaryActionProps={{ type: 'basic', leftIconName: 'PlusOutline' }}
        secondaryActionTranslationId="action__add_custom_tokens"
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
              topTokens={allTokens}
              tokens={mylist}
              keyword={keyword}
              terms={searchTerm}
              onChange={(text) => setKeyword(text)}
              onDelToken={(token) => onToggleDeleteDialog(token)}
            />
          ),
        }}
      />
      <Dialog
        visible={visible}
        onClose={() => onToggleDeleteDialog(undefined)}
        footerButtonProps={{
          primaryActionTranslationId: 'action__delete',
          primaryActionProps: { type: 'destructive', onPromise: onDelete },
        }}
        contentProps={{
          iconType: 'danger',
          title: intl.formatMessage({
            id: 'modal__delete_this_token',
            defaultMessage: 'Delete this token?',
          }),
          content: intl.formatMessage(
            {
              id: 'modal__delete_this_token_desc',
              defaultMessage: '{token} will be removed from my tokens',
            },
            { token: toDeletedToken?.name },
          ),
        }}
      />
    </>
  );
};

export default Listing;
