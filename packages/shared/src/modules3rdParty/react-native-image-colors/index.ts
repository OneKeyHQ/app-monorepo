import { getColors } from 'react-native-image-colors';

import platformEnv from '../../platformEnv';

import type { ImageColorsResult } from 'react-native-image-colors';

const parseHexColor = (hexColor: string) => {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.075)`;
};

const parseColorResult = (result: ImageColorsResult, defaultColor: string) => {
  if (platformEnv.isNativeIOS) {
    if ('background' in result) {
      return parseHexColor(result.background);
    }
  } else if ('vibrant' in result) {
    return parseHexColor(result.vibrant);
  }
  return defaultColor;
};

export const getPrimaryColor = async (url: string, defaultColor: string) => {
  try {
    const result = await getColors(url, { cache: true, key: url });
    return parseColorResult(result, defaultColor);
  } catch (e) {
    return defaultColor;
  }
};

export * from 'react-native-image-colors';
