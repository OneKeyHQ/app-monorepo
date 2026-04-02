import type { ReactNode } from 'react';

export type IUpdatePreviewActionButton = (props: {
  autoClose: boolean;
  isForceUpdate?: boolean;
}) => ReactNode;
