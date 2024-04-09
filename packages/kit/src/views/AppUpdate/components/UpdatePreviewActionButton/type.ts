import type { ReactNode } from 'react';

import type { IPageFooterProps } from '@onekeyhq/components';

export type IUpdatePreviewActionButton = (props: {
  onConfirm?: IPageFooterProps['onConfirm'];
}) => ReactNode;
