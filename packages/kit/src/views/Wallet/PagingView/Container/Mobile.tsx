import React, { Children, FC, useRef, useState } from 'react';

import NativePagingView from '@onekeyhq/app/src/views/PagingView';
import { Box, SegmentedControl } from '@onekeyhq/components';

import { PageViewProps } from '../type';

const Mobile: FC<PageViewProps> = ({
  renderHeader,
  headerHeight,
  children,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const ref = useRef<NativePagingView>(null);
  return (
    <NativePagingView
      ref={ref}
      defaultIndex={selectedIndex}
      headerHeight={headerHeight}
      renderHeader={renderHeader}
      scrollEnabled={false}
      renderTabBar={() => (
        <Box height="36px" paddingX="16px">
          <SegmentedControl
            values={Children.toArray(children).map(
              (child) =>
                // @ts-ignore
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
                child.props.label,
            )}
            selectedIndex={selectedIndex}
            onChange={(index) => {
              ref.current?.setPageIndex(index);
              setSelectedIndex(index);
            }}
          />
        </Box>
      )}
    >
      {children}
    </NativePagingView>
  );
};

export default Mobile;
