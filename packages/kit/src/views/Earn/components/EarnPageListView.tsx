import { createContext, useContext, useMemo } from 'react';

import { ListView } from '@onekeyhq/components';
import type { IListViewProps } from '@onekeyhq/components';

// List-mode Earn pages own their scrolling, so EarnPageContainer cannot pad a
// ScrollView for them. It publishes the iOS 26 native header height here and
// the list pads its own content with it: rows start below the translucent bar
// but still scroll underneath it, which is what lets iOS 26 draw the bar's
// scroll edge blur instead of clipping the list at the bar's bottom edge.
export const EarnPageListContentTopInsetContext = createContext(0);

export function EarnPageListView<T>({
  contentContainerStyle,
  ...props
}: IListViewProps<T>) {
  const contentTopInset = useContext(EarnPageListContentTopInsetContext);
  const style = useMemo(
    () =>
      contentTopInset > 0
        ? { ...contentContainerStyle, pt: contentTopInset }
        : contentContainerStyle,
    [contentContainerStyle, contentTopInset],
  );
  return <ListView<T> {...props} contentContainerStyle={style} />;
}
