import { useCallback, useEffect, useMemo } from 'react';

import { FlatList, StyleSheet } from 'react-native';

import { ModalContainer, Stack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/Navigation';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import MobileTabListItem from '../../components/MobileTabListItem';
import MobileTabListPinedItem from '../../components/MobileTabListItem/MobileTabListPinedItem';
import { TAB_LIST_CELL_COUNT_PER_ROW } from '../../config/TabList.constants';
import useWebTabAction from '../../hooks/useWebTabAction';
import { useActiveTabId, useWebTabs } from '../../hooks/useWebTabs';
import { withProviderWebTabs } from '../../store/contextWebTabs';

import type { DiscoverModalParamList } from '../../router/Routes';
import type { IWebTab } from '../../types';
import type { View } from 'react-native';

export const tabGridRefs: Record<string, View> = {};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  listContentContainer: {
    paddingBottom: 16,
  },
});

function MobileTabListModal() {
  const navigation =
    useAppNavigation<IPageNavigationProp<DiscoverModalParamList>>();

  const { tabs } = useWebTabs();
  const data = useMemo(() => (tabs ?? []).filter((t) => !t.isPined), [tabs]);
  const pinedData = useMemo(
    () => (tabs ?? []).filter((t) => t.isPined),
    [tabs],
  );

  useEffect(() => {
    console.log('MobileTabListModal data changed ===> : ', data);
  }, [data]);
  useEffect(() => {
    console.log('MobileTabListModal pinedData changed ===> : ', pinedData);
  }, [pinedData]);

  const { activeTabId } = useActiveTabId();
  const { setCurrentWebTab, closeWebTab, setPinedTab } = useWebTabAction();

  const keyExtractor = useCallback((item: IWebTab) => item.id, []);
  const renderItem = useCallback(
    ({ item: tab }: { item: IWebTab }) => (
      <MobileTabListItem
        {...tab}
        activeTabId={activeTabId}
        onSelectedItem={(id) => {
          setCurrentWebTab(id);
          navigation.pop();
        }}
        onCloseItem={(id) => {
          void closeWebTab(id);
        }}
      />
    ),
    [navigation, setCurrentWebTab, closeWebTab, activeTabId],
  );

  const ListHeader = useMemo(() => {
    if (pinedData.length === 0) {
      return null;
    }
    return (
      <>
        {pinedData.map((pinedTab) => (
          <MobileTabListPinedItem
            {...pinedTab}
            activeTabId={activeTabId}
            onSelectedItem={(id) => {
              setCurrentWebTab(id);
              navigation.pop();
            }}
            onCloseItem={(id) => {
              void closeWebTab(id);
            }}
            onLongPress={(id) => {
              void setPinedTab({ id, pined: false });
            }}
          />
        ))}
      </>
    );
  }, [
    pinedData,
    setCurrentWebTab,
    closeWebTab,
    activeTabId,
    navigation,
    setPinedTab,
  ]);

  const { addBlankWebTab, closeAllWebTab } = useWebTabAction();
  return (
    <ModalContainer
      onConfirm={() => {
        addBlankWebTab();
        navigation.pop();
      }}
      onCancel={() => closeAllWebTab()}
    >
      <Stack style={styles.container}>
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={TAB_LIST_CELL_COUNT_PER_ROW}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContentContainer}
          ListHeaderComponent={ListHeader}
        />
      </Stack>
    </ModalContainer>
  );
}

export default withProviderWebTabs(MobileTabListModal);
