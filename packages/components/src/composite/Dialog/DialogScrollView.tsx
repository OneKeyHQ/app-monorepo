import { ScrollView } from '../../layouts/ScrollView';

import type { IScrollViewProps } from '../../layouts/ScrollView';

export type IDialogScrollViewProps = Omit<
  IScrollViewProps,
  'contentContainerStyle'
>;

/**
 * Scrollable container for long Dialog content. The overlay sheet hands a
 * swipe to the content while it can scroll. Android requires nested scrolling
 * so its bottom sheet sees the content offset before taking a downward drag.
 */
export function DialogScrollView(props: IDialogScrollViewProps) {
  return <ScrollView nestedScrollEnabled {...props} />;
}
