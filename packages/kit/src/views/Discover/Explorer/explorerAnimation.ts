import { makeMutable, runOnJS, withTiming } from 'react-native-reanimated';

// for mobile tab animations
export const MIN_OR_HIDE = 0;
export const MAX_OR_SHOW = 1;
export const expandAnim = makeMutable(MIN_OR_HIDE);
export const showTabGridAnim = makeMutable(MIN_OR_HIDE);

export const showTabGrid = () => {
  // TODO withtiming
  showTabGridAnim.value = MAX_OR_SHOW;
};

export const hideTabGrid = () => {
  // TODO withtiming
  showTabGridAnim.value = MIN_OR_HIDE;
};

export const expandFloatingWindow = (onMaximize: () => void = () => {}) => {
  expandAnim.value = withTiming(MAX_OR_SHOW, { duration: 300 }, () =>
    runOnJS(onMaximize),
  );
};
export const minimizeFloatingWindow = (onMinimize?: () => void) => {
  onMinimize?.();
  expandAnim.value = withTiming(MIN_OR_HIDE, { duration: 300 });
};
export const toggleFloatingWindow = ({
  onMinimize,
  onMaximize,
}: {
  onMinimize?: () => void;
  onMaximize?: () => void;
}) => {
  if (expandAnim.value === MIN_OR_HIDE) {
    expandFloatingWindow(onMaximize);
  } else {
    minimizeFloatingWindow(onMinimize);
  }
};
