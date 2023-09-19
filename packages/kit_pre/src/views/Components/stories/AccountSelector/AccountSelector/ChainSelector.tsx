/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable no-nested-ternary */
import type { FC } from 'react';

import { StyleSheet } from 'react-native';

import {
  Box,
  FlatList,
  IconButton,
  Pressable,
  Token,
} from '@onekeyhq/components';

type ChainSelectorProps = {};

const defaultProps = {} as const;

const ChainSelector: FC<ChainSelectorProps> = () => {
  const ChainList = [
    {
      logoURL:
        'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png',
      isActive: true,
    },
    {
      logoURL:
        'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/btc.png',
      isActive: false,
    },
  ];

  return (
    <Box
      alignSelf="stretch"
      borderRightWidth={StyleSheet.hairlineWidth}
      borderColor="divider"
    >
      <FlatList
        data={ChainList}
        keyExtractor={(item) => item.logoURL}
        renderItem={({ item }) => (
          <Pressable>
            {({ isHovered, isPressed }) => (
              <Box
                p={1.5}
                m={1}
                borderWidth={2}
                borderColor={
                  item.isActive
                    ? 'interactive-default'
                    : isPressed
                    ? 'border-default'
                    : isHovered
                    ? 'border-subdued'
                    : 'transparent'
                }
                rounded="full"
              >
                <Token size={8} token={{ logoURI: item.logoURL }} />
              </Box>
            )}
          </Pressable>
        )}
        style={{ flex: 1, padding: 4 }}
      />
      <Box
        p={2}
        borderTopWidth={StyleSheet.hairlineWidth}
        borderColor="divider"
      >
        <IconButton name="CogOutline" size="xl" type="plain" circle />
      </Box>
    </Box>
  );
};

ChainSelector.defaultProps = defaultProps;

export default ChainSelector;
