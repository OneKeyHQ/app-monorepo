import { useCallback, useMemo } from 'react';

import { FlatList } from 'react-native';

import { ModalContainer } from '@onekeyhq/components';
import type { PageNavigationProp } from '@onekeyhq/components/src/Navigation';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import MobileTabListItem from '../../components/MobileTabListItem';
import useWebTabAction from '../../hooks/useWebTabAction';
import { useActiveTabId, useWebTabs } from '../../hooks/useWebTabs';
import { withProviderWebTabs } from '../../store/contextWebTabs';

import type { DiscoverModalParamList } from '../../router/Routes';
import type { IWebTab } from '../../types';
import type { View } from 'react-native';

export const tabGridRefs: Record<string, View> = {};

function MobileTabListModal() {
  const navigation =
    useAppNavigation<PageNavigationProp<DiscoverModalParamList>>();

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
          closeWebTab(id);
        }}
      />
    ),
    [navigation, setCurrentWebTab, closeWebTab, activeTabId],
  );
  const { addBlankWebTab, closeAllWebTab } = useWebTabAction();
  return (
    <ModalContainer
      onConfirm={() => addBlankWebTab()}
      onCancel={() => closeAllWebTab()}
    >
      <FlatList
        style={{ width: '100%', height: 200 }}
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
      />
    </ModalContainer>
  );
}

export default withProviderWebTabs(MobileTabListModal);
