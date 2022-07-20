import React, { FC, useRef, useState } from 'react';

import NativePagingView from '@onekeyhq/app/src/views/PagingView';
import { Box, SegmentedControl } from '@onekeyhq/components';

import { PageViewProps } from '../type';

const Mobile: FC<PageViewProps> = ({ items, renderHeader, headerHeight }) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const ref = useRef<NativePagingView>(null);
  return (
    <NativePagingView
      ref={ref}
      defaultIndex={selectedIndex}
      headerHeight={headerHeight}
      renderHeader={renderHeader}
      renderTabBar={() => (
        <SegmentedControl
          style={{ width: 300, height: 36, paddingLeft: 16, paddingRight: 16 }}
          values={items.map((tab) => tab.label)}
          selectedIndex={selectedIndex}
          onChange={(index) => {
            ref.current?.setPageIndex(index);
            setSelectedIndex(index);
          }}
        />
      )}
    >
      {items.map((tab) => (
        <Box key={tab.name}>{tab.view}</Box>
      ))}
    </NativePagingView>
  );
};

export default Mobile;
