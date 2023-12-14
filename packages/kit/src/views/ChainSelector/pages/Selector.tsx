import { useState } from 'react';

import { AnimatePresence } from 'tamagui';

import {
  Button,
  IButtonProps,
  ListItem,
  ListView,
  Page,
} from '@onekeyhq/components';

type IChainItem = {
  chain: string;
  name: string;
};

const DATA: IChainItem[] = [
  { chain: 'btc', name: 'Bitcoin' },
  {
    chain: 'eth',
    name: 'Ethereum',
  },
  {
    chain: 'matic',
    name: 'Polygon',
  },
  {
    chain: 'bnb',
    name: 'BNB Smart Chain',
  },
];

function getHeaderRightComponent(
  isEditMode: boolean,
  handleEditButtonPress: () => void,
) {
  return (
    <Button variant="tertiary" onPress={handleEditButtonPress}>
      {isEditMode ? 'Done' : 'Edit'}
    </Button>
  );
}

export function Selector() {
  const [selectedChain, setSelectedChain] = useState(DATA[0].chain);
  const [isEditMode, setIsEditMode] = useState(false);

  const handleListItemPress = (chain: IChainItem['chain']) => {
    setSelectedChain(chain);
  };

  const handleEditButtonPress = () => {
    setIsEditMode(!isEditMode);
  };

  return (
    <Page>
      <Page.Header
        title="Select chain"
        headerRight={() =>
          getHeaderRightComponent(isEditMode, handleEditButtonPress)
        }
        headerSearchBarOptions={{
          placeholder: 'Search',
        }}
      />
      <Page.Body>
        <ListView
          estimatedItemSize="$12"
          data={DATA}
          renderItem={({ item }: { item: IChainItem }) => (
            <ListItem
              avatarProps={{
                src: `https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/${item.chain}.png`,
                size: '$8',
              }}
              title={item.name}
              {...(!isEditMode && {
                onPress: () => handleListItemPress(item.chain),
                checkMark: selectedChain === item.chain,
              })}
            >
              <AnimatePresence>
                {isEditMode && (
                  <ListItem.IconButton
                    title="Move to top"
                    key="moveToTop"
                    animation="quick"
                    enterStyle={{
                      opacity: 0,
                      scale: 0,
                    }}
                    icon="AlignTopOutline"
                  />
                )}
              </AnimatePresence>
            </ListItem>
          )}
        />
      </Page.Body>
    </Page>
  );
}
