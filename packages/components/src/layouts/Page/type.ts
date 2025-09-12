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
    /** @platform cross-platform
     * @description Enable the insets that you use to determine the safe area for this view. The default value is true
     *  @default false
     */
    safeAreaEnabled?: boolean;
    /** @platform native
     * @description Lazy load. The default value is false.
     * Mainly used to reduce stuttering when heavy rendering Native pages.
     * If the page doesn't have much content on initial render, this doesn't need to be enabled.
     * @default false
     */
    lazyLoad?: boolean;
    /** @platform cross-platform
     * @description ScrollEnabled. When false, the view cannot be scrolled via interaction.
     * Note: If there are other scroll containers within the page, it may cause scroll conflicts on Native platforms.
     * @default false
     */
    scrollEnabled?: boolean;
    scrollProps?: Omit<IScrollViewProps, 'children'>;
  } & IPageLifeCycle
>;

export type IPageFooterProps = PropsWithChildren<
  IFooterActionsProps & { disableKeyboardAnimation?: boolean }
>;

export type IPageProps = IBasicPageProps;
