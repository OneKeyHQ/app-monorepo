import React, { FC } from 'react';

import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';

import { PageViewProps } from '../type';

const Desktop: FC<PageViewProps> = ({
  initialTabName,
  width,
  scrollEnabled,
  renderHeader,
  headerHeight,
  containerStyle,
  headerContainerStyle,
  renderTabBar,
  onTabChange,
  onIndexChange,
  children,
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
    {children as any}
  </Tabs.Container>
);
export default Desktop;
