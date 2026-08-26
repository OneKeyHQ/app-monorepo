import { useEffect } from 'react';

type IRecoveryPhraseProtectedDialogType =
  | 'recoveryPhrase'
  | 'sensitiveInformation';

type IUseRecoveryPhraseProtectedOptions = {
  dialogType?: IRecoveryPhraseProtectedDialogType;
  enabled?: boolean;
};

// Consumers nest (e.g. PhaseInputArea mounts inside pages that also call this
// hook), so a plain mount/unmount toggle would drop protection while a nested
// consumer is still on screen. Ref-count instead.
let activeConsumerCount = 0;

const setContentProtection = (enabled: boolean) => {
  void globalThis.desktopApiProxy?.security?.setContentProtection?.(enabled);
};

export const useRecoveryPhraseProtected = (
  options?: IUseRecoveryPhraseProtectedOptions,
) => {
  const enabled = options?.enabled ?? true;
  useEffect(() => {
    if (!enabled) {
      return;
    }
    activeConsumerCount += 1;
    if (activeConsumerCount === 1) {
      setContentProtection(true);
    }
    return () => {
      activeConsumerCount -= 1;
      if (activeConsumerCount === 0) {
        setContentProtection(false);
      }
    };
  }, [enabled]);
};
