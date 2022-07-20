import React, { FC } from 'react';

import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';

import { PageViewProps } from '../type';

const Desktop: FC<PageViewProps> = ({
  initialTabName,
  items,
  width,
  scrollEnabled,
  renderHeader,
  headerHeight,
  containerStyle,
  headerContainerStyle,
  renderTabBar,
  onTabChange,
  onIndexChange,
}) => (
  <Tabs.Container
    lazy
    initialTabName={initialTabName || undefined}
    onIndexChange={onIndexChange}
    onTabChange={onTabChange}
    renderHeader={renderHeader}
    width={width}
    pagerProps={{ scrollEnabled }}
    headerHeight={headerHeight}
    containerStyle={containerStyle}
    headerContainerStyle={headerContainerStyle}
    renderTabBar={renderTabBar}
  >
    {items.map((tab) => (
      <Tabs.Tab key={tab.name} name={tab.name} label={tab.label}>
        {tab.view}
      </Tabs.Tab>
    ))}
  </Tabs.Container>
);
export default Desktop;
