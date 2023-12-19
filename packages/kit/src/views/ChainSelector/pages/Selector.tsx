import { useCallback, useState } from 'react';

import { AnimatePresence } from 'tamagui';

import {
  Button,
  ListItem,
  Page,
  SortableCell,
  SortableListView,
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

const CELL_HEIGHT = 70;

export function Selector() {
  const [data, setData] = useState(DATA);
  const [selectedChain, setSelectedChain] = useState(DATA[0].chain);
  const [isEditMode, setIsEditMode] = useState(false);

  const handleListItemPress = (chain: IChainItem['chain']) => {
    setSelectedChain(chain);
  };

  const handleEditButtonPress = () => {
    setIsEditMode(!isEditMode);
  };

  const deleteItem = useCallback(
    (getIndex: () => number | undefined) => {
      const index = getIndex();
      if (index === undefined) {
        return;
      }
      const reloadData = [...data];
      reloadData.splice(index, 1);
      setData(reloadData);
    },
    [data, setData],
  );

  return (
    <Page>
      <Page.Header
        title="Select Chain"
        headerRight={() =>
          getHeaderRightComponent(isEditMode, handleEditButtonPress)
        }
        headerSearchBarOptions={{
          placeholder: 'Search',
        }}
      />
      <Page.Body>
        <SortableListView
          data={data}
          keyExtractor={(item) => `${item.chain}`}
          getItemLayout={(_, index) => ({
            length: CELL_HEIGHT,
            offset: index * CELL_HEIGHT,
            index,
          })}
          onDragEnd={(result) => setData(result.data)}
          renderItem={({ item, drag, isActive, getIndex }) => (
            <ListItem
              h={CELL_HEIGHT}
              avatarProps={{
                src: `https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/${item.chain}.png`,
                size: '$8',
              }}
              title={item.name}
              {...(!isEditMode && {
                onPress: () => handleListItemPress(item.chain),
              })}
            >
              <SortableCell
                drag={drag}
                isEditing={isEditMode}
                isActive={isActive}
                flex={undefined}
                px={15}
                onDeletePress={() => deleteItem(getIndex)}
              >
                <AnimatePresence exitBeforeEnter>
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
                  {!isEditMode && selectedChain === item.chain && (
                    <ListItem.CheckMark
                      key="checkmark"
                      enterStyle={{
                        opacity: 0,
                        scale: 0,
                      }}
                    />
                  )}
                </AnimatePresence>
              </SortableCell>
            </ListItem>
          )}
        />
      </Page.Body>
    </Page>
  );
}
