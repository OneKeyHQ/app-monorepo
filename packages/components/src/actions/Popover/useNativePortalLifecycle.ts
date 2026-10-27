import type {
  IUseNativePortalLifecycleProps,
  IUseNativePortalLifecycleResult,
} from './nativePortalLifecycleTypes';

export function useNativePortalLifecycle({
  isOpen,
  sheetProps,
}: IUseNativePortalLifecycleProps): IUseNativePortalLifecycleResult {
  return {
    shouldUseNativePortalLifecycle: false,
    isNativePortalMounted: false,
    popoverOpen: isOpen,
    resolvedSheetProps: sheetProps,
  };
}
