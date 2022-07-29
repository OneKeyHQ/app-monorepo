import React, { FC } from 'react';

import NativeNestedTabView from './NativeNestedTabView';
import { NativeNestedTabViewProps } from './types';

type NestedTabViewProps = {
  renderHeader?: () => React.ReactNode;
} & NativeNestedTabViewProps;

const NestedTabView: FC<NestedTabViewProps> = ({
  renderHeader,
  children,
  ...rest
}) => (
  <NativeNestedTabView {...rest}>
    {renderHeader?.()}
    {children}
  </NativeNestedTabView>
);

export default NestedTabView;
