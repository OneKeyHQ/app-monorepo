import type { ISheetOptions } from '../../hocs/NativeSheetPresentation/types';

export type IUseNativePortalLifecycleProps = {
  isOpen?: boolean;
  sheetProps?: ISheetOptions;
  mountNativePortalBeforeOpen?: boolean;
};

export type IUseNativePortalLifecycleResult = {
  shouldUseNativePortalLifecycle: boolean;
  isNativePortalMounted: boolean;
  popoverOpen?: boolean;
  resolvedSheetProps?: ISheetOptions;
};
