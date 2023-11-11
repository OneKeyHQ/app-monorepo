import { useCallback, useMemo } from 'react';

import { FlatList, StyleSheet } from 'react-native';

import { ModalContainer, Stack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/Navigation';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import MobileTabListItem from '../../components/MobileTabListItem';
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
  const data = useMemo(() => tabs, [tabs]);
  const { activeTabId } = useActiveTabId();
  const { setCurrentWebTab, closeWebTab } = useWebTabAction();

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

  const { addBlankWebTab, closeAllWebTab } = useWebTabAction();
  return (
    <ModalContainer
      onConfirm={() => {
        addBlankWebTab();
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
        />
      </Stack>
    </ModalContainer>
  );
}

export default withProviderWebTabs(MobileTabListModal);
