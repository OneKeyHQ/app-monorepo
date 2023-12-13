import type { PropsWithChildren } from 'react';

export type IBasicPageProps = PropsWithChildren<{
  /* enable the insets that you use to determine the safe area for this view. the default value is false  */
  enableSafeArea?: boolean;
  /* skip loading view. the default value is false  */
  skipLoading?: boolean;
}>;

export type IPageProps = IBasicPageProps;
