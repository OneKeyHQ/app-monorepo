import type { PropsWithChildren } from 'react';

import { WebPagerContent } from '@onekeyhq/kit/src/components/WebCollapsiblePager';

import type { ScrollViewProps } from 'react-native';

// Shared Home callers supply native-only scroll props; Web content stays in
// the enclosing Pager's single NativeScroller, as before.
export function HomeScrollView({
  children,
  style,
}: PropsWithChildren<ScrollViewProps>) {
  return <WebPagerContent style={style}>{children}</WebPagerContent>;
}
