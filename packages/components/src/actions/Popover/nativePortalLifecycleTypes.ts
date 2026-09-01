import type { SheetProps } from '../../shared/tamagui';

export type IUseNativePortalLifecycleProps = {
  isOpen?: boolean;
  sheetProps?: SheetProps;
  mountNativePortalBeforeOpen?: boolean;
};

export type IUseNativePortalLifecycleResult = {
  shouldUseNativePortalLifecycle: boolean;
  isNativePortalMounted: boolean;
  popoverOpen?: boolean;
  resolvedSheetProps?: SheetProps;
};
