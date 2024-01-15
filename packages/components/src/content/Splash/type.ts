import type { PropsWithChildren } from 'react';

import type { LayoutChangeEvent } from 'react-native';

export interface ISplashViewProps {
  onReady: () => void;
}

export type ISplashViewChildrenContentProps = PropsWithChildren<{
  onLayout?: (event: LayoutChangeEvent) => void;
}>;
