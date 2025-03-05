// Custom implementation of globalRef to fix lint errors
const defaultGlobalRef = {
  translationY: 0,
  reset: () => {},
};

export const globalRef = {
  ...defaultGlobalRef,
};

export const resetGlobalRef = () => {
  globalRef.reset = defaultGlobalRef.reset;
  globalRef.translationY = defaultGlobalRef.translationY;
};
