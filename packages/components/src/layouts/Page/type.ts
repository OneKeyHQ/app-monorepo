import type { PropsWithChildren } from 'react';

import type { IFooterActionsProps } from './PageFooterActions';
import type { IStackProps } from '../../primitives';
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
  // registers a callback to be called when the page needs to redirect.
  onRedirected?: () => void;
  // determines whether to redirect the page.
  shouldRedirect?: () => boolean;
}

export type IBasicPageProps = PropsWithChildren<
  {
    /** @platform native
     * @description Marks the page as filling its container.
     *
     * NOTE: this currently has no effect, and the behavior is still wanted —
     * it needs re-implementing rather than removing. Its only implementation was
     * the `useMinHeight` calculation in BasicPage.native.tsx, which was reachable
     * only from inside the `lazyLoad` overlay branch. No call site has ever set
     * both `fullPage` and `lazyLoad`, so that min-height never applied to any of
     * the seven pages passing this prop. Removing the overlay deleted the dead
     * calculation; it did not change behavior.
     */
    fullPage?: boolean;
    /** @platform cross-platform
     * @description Enable the insets that you use to determine the safe area for this view. The default value is true
     *  @default false
     */
    safeAreaEnabled?: boolean;
    /** @platform native
     * @deprecated No-op. This used to gate a fixed-duration spinner overlay that
     * hid the first ~160ms of a heavy native page mount. iOS stopped honoring it
     * once the performWithoutAnimation patch removed the artifact it covered, and
     * Android followed; see BasicPage.native.tsx. Kept so existing call sites keep
     * compiling — do not add new ones.
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
    /** @platform cross-platform
     * @description Test ID for end-to-end testing.
     */
    testID?: string;
    /** @platform cross-platform
     * @description Background color for the page root, including safe areas.
     * @default $bgApp
     */
    backgroundColor?: IStackProps['backgroundColor'];
  } & IPageLifeCycle
>;

export type IPageFooterSafeAreaBottomMode = 'container' | 'content';

export type IPageFooterProps = PropsWithChildren<
  IFooterActionsProps & {
    disableKeyboardAnimation?: boolean;
    /**
     * Controls which layer owns the footer bottom safe-area spacing.
     * `container` lets Page.Footer handle it; `content` is for custom content
     * that already applies the native bottom inset itself.
     * @default container
     */
    safeAreaBottomMode?: IPageFooterSafeAreaBottomMode;
  }
>;

export type IPageProps = IBasicPageProps;

export type IPageContentContainerLayout = 'full' | 'regular' | 'compact';
export type IPageContentContainerProps = Omit<IStackProps, 'layout'> & {
  layout?: IPageContentContainerLayout;
  padded?: boolean;
};
