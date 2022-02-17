import React, {
  FC,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useNavigation } from '@react-navigation/core';
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
import { useGeneral, useSettings } from '../../hooks/redux';

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
  const [selectedToken, setSelectedToken] = useState<TypeOfToken>();
  const { activeNetwork, activeAccount } = useGeneral();
  const { refreshTimeStamp } = useSettings();

  const onDelete = useCallback(async () => {
    if (activeAccount && selectedToken) {
      await engine.removeTokenFromAccount(activeAccount.id, selectedToken?.id);
    }
    setSelectedToken(undefined);
  }, [activeAccount, selectedToken]);

  useEffect(() => {
    async function fetchTokens() {
      if (activeNetwork?.network) {
        const resFortop50list = await engine.getTokens(
          activeNetwork.network.id,
        );
        setTop50List(resFortop50list);
      }
      if (activeNetwork?.network && activeAccount) {
        const resFormylist = await engine.getTokens(
          activeNetwork.network.id,
          activeAccount.id,
        );
        console.log('resFormylist', resFormylist);
        setMyList(resFormylist);
      }
    }
    fetchTokens();
  }, [activeNetwork, activeAccount, refreshTimeStamp]);

  const searched = useMemo(() => {
    if (!keyword) {
      return [];
    }
    const allTokens: TypeOfToken[] = ([] as TypeOfToken[]).concat(
      mylist,
      top50list,
    );
    const result = allTokens.filter(
      (item) =>
        item.name.toLowerCase().includes(keyword.toLowerCase()) ||
        item.symbol.toLowerCase().includes(keyword.toLowerCase()),
    );
    return result;
  }, [keyword, mylist, top50list]);

  const renderItem = ({ item }: { item: TypeOfToken }) => (
    <Box
      display="flex"
      flexDirection="row"
      justifyContent="space-between"
      p="4"
      alignItems="center"
    >
      <Token
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
            data={top50list}
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
          onPrimaryActionPress: onDelete,
          primaryActionTranslationId: 'action__delete',
          primaryActionProps: { type: 'destructive' },
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
