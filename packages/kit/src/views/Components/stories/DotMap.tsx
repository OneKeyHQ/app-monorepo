import { useCallback, useMemo, useState } from 'react';

import * as bip39 from 'bip39';

import {
  Box,
  Button,
  FlatList,
  ScrollView,
  Typography,
} from '@onekeyhq/components';

import DotMnemonicWord from '../../KeyTag/Component/DotMap/DotMnemonicWord';
import { mnemonicWordToKeyTagMnemonic } from '../../KeyTag/utils';

import type { KeyTagMnemonic } from '../../KeyTag/types';
import type { ListRenderItemInfo } from 'react-native';

const DotMapGallery = () => {
  const wordlist = bip39.wordlists.english;
  const wordlistKeytag = useMemo(
    () =>
      wordlist.map((word, index) => {
        const keytagMnemonic: KeyTagMnemonic = {
          index,
          mnemonicWord: word,
          ...mnemonicWordToKeyTagMnemonic(word),
        };
        return keytagMnemonic;
      }),
    [wordlist],
  );
  const [currentPageData, setCurrentPageData] = useState(
    wordlistKeytag.slice(0, 10),
  );
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<KeyTagMnemonic>) => (
      <Box p={4}>
        <Typography.Body2Strong>
          {item.mnemonicWord ?? ''}
        </Typography.Body2Strong>
        <DotMnemonicWord mnemonicWordData={item} disabled />
      </Box>
    ),
    [],
  );
  return (
    <ScrollView>
      <Box flexDirection="row">
        <Button
          onPress={() => {
            const firstIndex = wordlistKeytag.findIndex(
              (item) => item.index === currentPageData[0].index,
            );
            if (firstIndex !== 0) {
              setCurrentPageData(
                wordlistKeytag.slice(firstIndex - 10, firstIndex),
              );
            }
          }}
        >
          上一页
        </Button>
        <Button
          onPress={() => {
            const firstIndex = wordlistKeytag.findIndex(
              (item) => item.index === currentPageData[0].index,
            );
            if (
              firstIndex !== wordlistKeytag.length - 1 &&
              firstIndex !== -1 &&
              firstIndex + 10 < wordlistKeytag.length
            ) {
              setCurrentPageData(
                wordlistKeytag.slice(firstIndex + 10, firstIndex + 20),
              );
            }
          }}
        >
          下一页
        </Button>
      </Box>
      <FlatList data={currentPageData} renderItem={renderItem} />
    </ScrollView>
  );
};

export default DotMapGallery;
