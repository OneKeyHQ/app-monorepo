import React, {
  FC,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useFocusEffect, useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Dialog,
  Divider,
  Empty,
  FlatList,
  IconButton,
  KeyboardDismissView,
  Modal,
  Searchbar,
  Token,
  Typography,
  utils,
} from '@onekeyhq/components';
import { Token as TypeOfToken } from '@onekeyhq/engine/src/types/token';

import engine from '../../engine/EngineProvider';
import { useGeneral } from '../../hooks/redux';

import { ManageTokenRoutes, ManageTokenRoutesParams } from './types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  ManageTokenRoutesParams,
  ManageTokenRoutes.Listing
>;

const isValidateAddr = (addr: string) => addr.length === 42;

export const Listing: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const [keyword, setKeyword] = useState<string>('');
  const [top50list, setTop50List] = useState<TypeOfToken[]>([]);
  const [mylist, setMyList] = useState<TypeOfToken[]>([]);
  const [list, setList] = useState<TypeOfToken[]>([]);

  const [selectedToken, setSelectedToken] = useState<TypeOfToken>();
  const { activeNetwork, activeAccount } = useGeneral();

  useEffect(() => {
    const set = new Set(mylist.map((item) => item.tokenIdOnNetwork));
    const filtered = top50list.filter(
      (item) => !set.has(item.tokenIdOnNetwork),
    );
    setList(filtered);
  }, [top50list, mylist]);

  const fetchTokens = useCallback(async () => {
    if (activeNetwork?.network) {
      const start1 = Date.now();
      const resFortop50list = await engine.getTokens(activeNetwork.network.id);
      setTop50List(resFortop50list);
      const end1 = Date.now();
      console.log(
        'get all tokens spent time is',
        `${(end1 - start1) / 1000} s`,
      );
    }
    if (activeNetwork?.network && activeAccount) {
      const start2 = Date.now();
      const resFormylist = await engine.getTokens(
        activeNetwork.network.id,
        activeAccount.id,
      );
      const end2 = Date.now();
      console.log(
        'get user tokens spent time is',
        `${(end2 - start2) / 1000} s`,
      );
      console.log('resFormylist', resFormylist);
      setMyList(resFormylist);
    }
  }, [activeNetwork, activeAccount]);

  const onDelete = useCallback(async () => {
    if (activeAccount && selectedToken) {
      await engine.removeTokenFromAccount(activeAccount.id, selectedToken?.id);
    }
    setSelectedToken(undefined);
    await fetchTokens();
  }, [activeAccount, selectedToken, fetchTokens]);

  useFocusEffect(
    useCallback(() => {
      fetchTokens();
    }, [fetchTokens]),
  );

  const searched = useMemo(() => {
    if (!keyword) {
      return [];
    }
    const allTokens: TypeOfToken[] = ([] as TypeOfToken[]).concat(mylist, list);
    const result = allTokens.filter(
      (item) =>
        item.name.toLowerCase().includes(keyword.toLowerCase()) ||
        item.symbol.toLowerCase().includes(keyword.toLowerCase()) ||
        item.tokenIdOnNetwork.toLowerCase().includes(keyword.toLowerCase()),
    );
    return result;
  }, [keyword, mylist, list]);

  const renderItem = ({ item }: { item: TypeOfToken }) => (
    <Box
      display="flex"
      flexDirection="row"
      justifyContent="space-between"
      p="4"
      alignItems="center"
    >
      <Token
        src={item.logoURI}
        size="8"
        chain="eth"
        name={item.name}
        address={item.tokenIdOnNetwork}
        description={utils.shortenAddress(item.tokenIdOnNetwork)}
      />
      <IconButton
        name="PlusSolid"
        type="plain"
        onPress={() => {
          navigation.navigate(ManageTokenRoutes.AddToken, {
            name: item.name,
            symbol: item.symbol,
            address: item.tokenIdOnNetwork,
            decimal: item.decimals,
            logoURI: item.logoURI,
          });
        }}
      />
    </Box>
  );
  const renderOwnedItem = ({ item }: { item: TypeOfToken }) => (
    <Box
      display="flex"
      flexDirection="row"
      justifyContent="space-between"
      p="4"
      alignItems="center"
    >
      <Token
        src={item.logoURI}
        size="8"
        chain="eth"
        name={item.name}
        address={item.tokenIdOnNetwork}
        description={`0 ${item.symbol}`}
      />
      <IconButton
        name="TrashSolid"
        type="plain"
        onPress={() => {
          setSelectedToken(item);
        }}
      />
    </Box>
  );

  let contentView: ReactElement | undefined;
  if (keyword) {
    contentView = searched.length ? (
      <FlatList
        bg="surface-default"
        borderRadius="12"
        mt="3"
        mb="3"
        data={searched}
        renderItem={renderOwnedItem}
        ItemSeparatorComponent={() => <Divider />}
        keyExtractor={(_, index: number) => index.toString()}
        showsVerticalScrollIndicator={false}
      />
    ) : (
      <Empty
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
          if (isValidateAddr(keyword)) {
            params.address = keyword;
          }
          navigation.navigate(ManageTokenRoutes.CustomToken, params);
        }}
      />
    );
  } else {
    contentView = (
      <Box>
        {mylist.length ? (
          <Box>
            <Typography.Subheading color="text-subdued">
              {intl.formatMessage({
                id: 'form__my_tokens',
                defaultMessage: 'MY TOKENS',
              })}
            </Typography.Subheading>
            <FlatList
              bg="surface-default"
              borderRadius="12"
              mt="3"
              mb="3"
              data={mylist}
              renderItem={renderOwnedItem}
              ItemSeparatorComponent={() => <Divider />}
              keyExtractor={(_, index: number) => index.toString()}
              showsVerticalScrollIndicator={false}
            />
          </Box>
        ) : null}
        <Box>
          <Typography.Subheading color="text-subdued" mt="2">
            {intl.formatMessage({
              id: 'form__top_50_tokens',
              defaultMessage: 'TOP 50 TOKENS',
            })}
          </Typography.Subheading>
          <FlatList
            bg="surface-default"
            borderRadius="12"
            mt="3"
            mb="3"
            data={list}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <Divider />}
            keyExtractor={(_, index: number) => index.toString()}
            showsVerticalScrollIndicator={false}
          />
        </Box>
      </Box>
    );
  }

  return (
    <>
      <Modal
        header={intl.formatMessage({
          id: 'title__manage_tokens',
          defaultMessage: 'Manage Tokens',
        })}
        height="560px"
        headerDescription="Ethereum Mainnet"
        hidePrimaryAction
        onSecondaryActionPress={() => {
          navigation.navigate(ManageTokenRoutes.CustomToken);
        }}
        secondaryActionProps={{ type: 'basic', leftIconName: 'PlusOutline' }}
        secondaryActionTranslationId="action__add_custom_tokens"
        scrollViewProps={{
          children: (
            <KeyboardDismissView>
              <Box>
                <Searchbar
                  w="full"
                  placeholder={intl.formatMessage({
                    id: 'form__search_tokens',
                    defaultMessage: 'Search Tokens',
                  })}
                  mb="6"
                  value={keyword}
                  onClear={() => setKeyword('')}
                  onChangeText={(text) => setKeyword(text.trim())}
                />
                {contentView}
              </Box>
            </KeyboardDismissView>
          ),
        }}
      />
      <Dialog
        visible={!!selectedToken}
        onClose={() => setSelectedToken(undefined)}
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
            { token: selectedToken?.name },
          ),
        }}
      />
    </>
  );
};

export default Listing;
