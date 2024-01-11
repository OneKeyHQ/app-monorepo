import { useState } from 'react';

import { Button, ListItem, Page, SortableListView } from '@onekeyhq/components';

import useAppNavigation from '../../../hooks/useAppNavigation';

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

const CELL_HEIGHT = 48;

export function Selector() {
  const [data, setData] = useState(DATA);
  const [selectedChain, setSelectedChain] = useState(DATA[0].chain);
  const [isEditMode, setIsEditMode] = useState(false);
  const navigation = useAppNavigation();

  const handleListItemPress = (chain: IChainItem['chain']) => {
    setSelectedChain(chain);
    navigation.pop();
  };

  const handleEditButtonPress = () => {
    setIsEditMode(!isEditMode);
  };

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
          renderItem={({ item, drag }) => (
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
              {isEditMode && (
                <ListItem.IconButton
                  key="darg"
                  animation="quick"
                  enterStyle={{
                    opacity: 0,
                    scale: 0,
                  }}
                  cursor="move"
                  icon="DragOutline"
                  onPressIn={drag}
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
            </ListItem>
          )}
        />
      </Page.Body>
    </Page>
  );
}

export default Selector;
