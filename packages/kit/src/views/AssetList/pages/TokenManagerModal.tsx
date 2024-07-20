import { useCallback, useEffect, useState } from 'react';

import { Keyboard, StyleSheet } from 'react-native';

import {
  Divider,
  ListView,
  Page,
  SearchBar,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { TokenIconView } from '@onekeyhq/kit/src/components/TokenListView/TokenIconView';

import { useTokenListAtom } from '../../../states/jotai/contexts/tokenList';
import { HomeTokenListProviderMirror } from '../../Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';

function TokenManagerModal() {
  const [tokenList] = useTokenListAtom();

  const [searchValue, setSearchValue] = useState('');
  useEffect(() => {
    console.log('===>TokenList: ', tokenList);
  }, [tokenList]);

  return (
    <Page safeAreaEnabled>
      <Page.Header title="Manage Token" />
      <Page.Body>
        <Stack mx="$4">
          <SearchBar
            placeholder="Search symbol or contract"
            autoFocus
            zIndex={20}
            selectTextOnFocus
            value={searchValue}
            onSearchTextChange={setSearchValue}
            onSubmitEditing={() => {
              console.log('submit search value: => : ', searchValue);
            }}
          />
        </Stack>
        <ListView
          data={tokenList.tokens}
          ListHeaderComponent={
            <>
              <ListItem
                mt="$4"
                title="Manually add a token"
                onPress={() => {
                  console.log('=====>>>> Manully Add');
                }}
              >
                <ListItem.IconButton
                  icon="ChevronRightSmallOutline"
                  onPress={() => console.log('Delete butto')}
                />
              </ListItem>
              <Divider />
              <SizableText mt={10} px="$5" size="$bodyMd" color="$textSubdued">
                Added token
              </SizableText>
            </>
          }
          keyExtractor={(item) => item.$key}
          renderItem={({ item }) => (
            <ListItem>
              <TokenIconView
                icon={item.logoURI}
                networkId="evm--1"
                isAllNetworks
              />
              <ListItem.Text
                flex={1}
                align="right"
                primary={<SizableText>{item.name}</SizableText>}
                primaryTextProps={{
                  size: '$bodyLgMedium',
                }}
              />
              <ListItem.IconButton
                icon="DeleteOutline"
                onPress={() => console.log('Delete butto')}
              />
            </ListItem>
          )}
        />
      </Page.Body>
    </Page>
  );
}

function TokenManagerModalContainer() {
  return (
    <HomeTokenListProviderMirror>
      <TokenManagerModal />
    </HomeTokenListProviderMirror>
  );
}

export default TokenManagerModalContainer;
