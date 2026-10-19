import type { ReactNode } from 'react';

import { Breadcrumb, YStack, useMedia } from '@onekeyhq/components';
import type { IBreadcrumbProps } from '@onekeyhq/components';

/**
 * A focused flow (add, remove, exit, a task) as one column. On desktop it
 * sits in the middle of the page with its breadcrumb on top, rather than a
 * narrow strip along the left edge; phones keep the full width. Pages pass
 * the breadcrumb here instead of to the page container on desktop.
 */
export function PoolsFlowColumn({
  breadcrumbProps,
  maxWidth,
  children,
}: {
  /** None while loading */
  breadcrumbProps?: IBreadcrumbProps;
  maxWidth: number;
  children: ReactNode;
}) {
  const { gtMd } = useMedia();
  return (
    <YStack
      px="$pagePadding"
      gap="$5"
      pt={gtMd ? '$0' : '$4'}
      w="100%"
      maxWidth={gtMd ? maxWidth : undefined}
      alignSelf={gtMd ? 'center' : undefined}
    >
      {gtMd && breadcrumbProps ? <Breadcrumb {...breadcrumbProps} /> : null}
      {children}
    </YStack>
  );
}
