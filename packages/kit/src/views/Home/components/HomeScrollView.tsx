import type { ComponentProps, PropsWithChildren } from 'react';

import { AppPagerContent } from '@onekeyhq/kit/src/components/AppPager/AppPagerContent';

import type { ScrollViewProps } from 'react-native';

// Shared Home callers supply native-only scroll props; Web content stays in
// the enclosing Pager's single NativeScroller, as before.
export function HomeScrollView({
  children,
  style,
}: PropsWithChildren<ScrollViewProps>) {
  return (
    <AppPagerContent
      style={style as ComponentProps<typeof AppPagerContent>['style']}
    >
      {children}
    </AppPagerContent>
  );
}
