import { BottomSheet } from '../BottomSheet';

import type { IDialogV2Props } from './type';

/**
 * On native the dialog IS the system sheet: the shell contract maps onto
 * ../BottomSheet one-to-one, so this engine is a bare pass-through. What
 * DialogV2 adds is the cross-platform pairing — web modal, native sheet —
 * behind one name; content is the caller's entirely.
 */
export function DialogV2(props: IDialogV2Props) {
  return <BottomSheet {...props} />;
}
