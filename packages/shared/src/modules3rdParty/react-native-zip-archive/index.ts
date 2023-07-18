import type { zip as ZipType } from 'react-native-zip-archive';

export const zip: typeof ZipType = () => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('The zip method is not supported on the this platform.');
  }
  return Promise.resolve('');
};
