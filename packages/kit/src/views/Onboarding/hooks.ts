import { useCallback, useRef } from 'react';

import { useIsFocused } from '@react-navigation/native';

import { useNavigationActions } from '../../hooks';
import { useNavigationBack } from '../../hooks/useAppNavigation';
import { closeExtensionWindowIfOnboardingFinished } from '../../hooks/useOnboardingRequired';

// TODO use context instead
export function useOnboardingLayoutVisible() {
  const isFocus = useIsFocused();
  const customVisibleRef = useRef<boolean | undefined>();
  if (isFocus) {
    // reset to undefined when route focused
    customVisibleRef.current = undefined;
  }

  const visible = customVisibleRef.current ?? isFocus;

  return {
    visible,
    customVisibleRef,
  };
}

export function useOnboardingClose() {
  const { resetToRoot } = useNavigationActions();

  const onSkip = useCallback(() => {
    resetToRoot();
    closeExtensionWindowIfOnboardingFinished();
  }, [resetToRoot]);

  const goBack = useNavigationBack({ fallback: onSkip });
  return {
    onboardingGoBack: goBack,
  };
}
