import { useContext } from 'react';

import { ScrollView } from '../../layouts/ScrollView';
import { Sheet } from '../../shared/tamagui';

import { DialogSheetContext } from './context';

import type { IScrollViewProps } from '../../layouts/ScrollView';

// tamagui's ScrollView types `contentContainerStyle` differently from ours, and
// no dialog needs it: style the inner content with a plain Stack instead.
export type IDialogScrollViewProps = Omit<
  IScrollViewProps,
  'contentContainerStyle'
>;

/**
 * Scrollable container for long Dialog content.
 *
 * On `md` the Dialog is a tamagui Sheet whose PanResponder decides between
 * "scroll the content" and "drag the sheet away" by reading `scrollBridge.y`.
 * Only Sheet.ScrollView feeds that value, so a plain ScrollView leaves it at 0
 * and every vertical swipe inside the dialog drags the sheet instead of
 * scrolling the list (OK-61140).
 *
 * Outside the sheet (desktop dialog, extension popup) it falls back to the
 * regular ScrollView: Sheet.ScrollView resolves an empty sheet context there
 * and would throw on scroll.
 */
export function DialogScrollView(props: IDialogScrollViewProps) {
  const isInSheet = useContext(DialogSheetContext);

  if (isInSheet) {
    return (
      <Sheet.ScrollView
        // Sheet.ScrollView defaults to flex={1}, which collapses to zero height
        // inside the `snapPointsMode="fit"` sheet frame. Size to content and let
        // the caller's height/maxHeight cap it, matching plain ScrollView.
        flex={0}
        {...props}
      />
    );
  }

  return <ScrollView {...props} />;
}
