import type { PropsWithChildren } from 'react';

import type { IFooterActionsProps } from './PageFooterActions';

export type IBasicPageProps = PropsWithChildren<{
  /* enable the insets that you use to determine the safe area for this view. the default value is true  */
  safeAreaEnabled?: boolean;
  /* skip loading view. the default value is false  */
  skipLoading?: boolean;
  /* scrollEnabled. When false, the view cannot be scrolled via interaction.  */
  scrollEnabled?: boolean;
}>;

export type IPageFooterProps = PropsWithChildren<
  IFooterActionsProps & {
    /* A marker property for telling the list to re-render (since it implements PureComponent).  */
    extraData?: any[];
  }
>;

export type IPageProps = IBasicPageProps;
