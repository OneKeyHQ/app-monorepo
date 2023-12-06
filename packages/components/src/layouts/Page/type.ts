import type { PropsWithChildren } from 'react';

export type IBasicPageProps = PropsWithChildren<{
  enableSafeArea?: boolean;
  skipLoading?: boolean;
}>;

export type IPageProps = IBasicPageProps;
