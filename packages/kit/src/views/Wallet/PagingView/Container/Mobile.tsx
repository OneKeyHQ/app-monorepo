import React, { Children, FC, useRef, useState } from 'react';

import NativePagingView from '@onekeyhq/app/src/views/PagingView';
import { SegmentedControl } from '@onekeyhq/components';

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
      renderTabBar={() => (
        <SegmentedControl
          style={{ width: 300, height: 36, paddingLeft: 16, paddingRight: 16 }}
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
      )}
    >
      {children}
    </NativePagingView>
  );
};

export default Mobile;
