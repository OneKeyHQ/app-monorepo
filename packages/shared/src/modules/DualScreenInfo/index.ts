export const isDualScreenDevice = () => {
  return false;
};

export const isRawSpanning = () => {
  return false;
};

export const isSpanning = () => {
  return isRawSpanning();
};

export const useIsSpanningInDualScreen = () => {
  return false;
};
