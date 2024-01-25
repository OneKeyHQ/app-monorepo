import { useState } from 'react';

import type { IPageScreenProps } from '@onekeyhq/components';
import { Button, ListItem, Page, SortableListView } from '@onekeyhq/components';
import { mockPresetNetworksList } from '@onekeyhq/kit-bg/src/mock';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  useAccountSelectorActions,
  useAccountSelectorContextData,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';

import type {
  EChainSelectorPages,
  IChainSelectorParamList,
} from '../router/type';

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

function ChainSelector({ num }: { num: number }) {
  const {
    activeAccount: { network },
  } = useActiveAccount({ num });
  const actions = useAccountSelectorActions();
  const navigation = useAppNavigation();
  const { config } = useAccountSelectorContextData();
  const [data, setData] = useState(config?.networks || mockPresetNetworksList);
  const selectedChain = network?.id;
  const [isEditMode, setIsEditMode] = useState(false);

  const handleListItemPress = (networkId: string) => {
    actions.current.updateSelectedAccount({
      num,
      builder: (v) => ({
        ...v,
        networkId,
      }),
    });
    navigation.popStack();
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
          keyExtractor={(item) => `${item.id}`}
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
                src:
                  item.logoURI ||
                  `https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/${item.code}.png`,
                size: '$8',
              }}
              title={item.name}
              {...(!isEditMode && {
                onPress: () => handleListItemPress(item.id),
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
              {!isEditMode && selectedChain === item.id && (
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

export default function ChainSelectorPage({
  route,
}: IPageScreenProps<
  IChainSelectorParamList,
  EChainSelectorPages.ChainSelector
>) {
  const { num, sceneName, sceneUrl, networks, defaultNetworkId } = route.params;
  return (
    <AccountSelectorProviderMirror
      enabledNum={[num]}
      config={{
        sceneName,
        sceneUrl,
        networks,
        defaultNetworkId,
      }}
    >
      <ChainSelector num={num} />
    </AccountSelectorProviderMirror>
  );
}
