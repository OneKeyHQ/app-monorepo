import type { PropsWithChildren } from 'react';

import type { IFooterActionsProps } from './PageFooterActions';
import type { IScrollViewProps } from '../ScrollView';

export interface IPageLifeCycle {
  // registers a callback to be called after the component has been mounted.
  onMounted?: () => void;
  // registers a callback to be called after the component has been unmounted.
  onUnmounted?: () => void;
  // registers a callback to be called when the page closed but the page confirm button has been not clicked.
  onCancel?: () => void;
  // registers a callback to be called when the page closed but the page confirm button has been clicked.
  onConfirm?: () => void;
  // registers a callback to be called when the page closed.
  onClose?: (extra?: { flag?: string }) => void;
}

export type IBasicPageProps = PropsWithChildren<
  {
    fullPage?: boolean;
    /* enable the insets that you use to determine the safe area for this view. the default value is true  */
    safeAreaEnabled?: boolean;
    /* skip loading view. the default value is false  */
    skipLoading?: boolean;
    /* scrollEnabled. When false, the view cannot be scrolled via interaction.  */
    scrollEnabled?: boolean;
    scrollProps?: Omit<IScrollViewProps, 'children'>;
  } & IPageLifeCycle
>;

export type IPageFooterProps = PropsWithChildren<IFooterActionsProps>;

export type IPageProps = IBasicPageProps;
