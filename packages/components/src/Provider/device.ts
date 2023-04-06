export const SCREEN_SIZE = {
  MEDIUM: 768, // tablets
  LARGE: 1024, // laptops/desktops
  XLARGE: 1280, // extra Large laptops/desktops
  ULTRALARGE: 9999,
} as const;

export type DeviceState = {
  size: 'SMALL' | 'NORMAL' | 'LARGE' | 'XLARGE';
  screenWidth: number;
  screenHeight: number;
};

export const getScreenSize = (screenWidth: number): DeviceState['size'] => {
  if (!screenWidth) {
    return 'NORMAL';
  }

  // (0, SCREEN_SIZE.MEDIUM)
  // https://www.ios-resolution.com/
  // iPad Mini (6th gen)	744
  // iPad Mini (5th gen)	768
  if (screenWidth <= SCREEN_SIZE.MEDIUM) {
    return 'SMALL';
  }

  // [SCREEN_SIZE.MEDIUM, SCREEN_SIZE.LARGE)
  if (screenWidth <= SCREEN_SIZE.LARGE) {
    return 'NORMAL';
  }

  // [SCREEN_SIZE.LARGE, SCREEN_SIZE.XLARGE)
  if (screenWidth <= SCREEN_SIZE.XLARGE) {
    return 'LARGE';
  }

  // [SCREEN_SIZE.XLARGE, ∞)
  if (screenWidth > SCREEN_SIZE.XLARGE) {
    return 'XLARGE';
  }

  return 'NORMAL';
};
