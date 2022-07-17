import { Cloudinary } from '@cloudinary/url-gen';
import { scale } from '@cloudinary/url-gen/actions/resize';
import { PixelRatio } from 'react-native';

import { CLOUNDINARY_NAME_KEY } from '../config';

const cloudName = CLOUNDINARY_NAME_KEY;
const pixelRatio = PixelRatio.get();

// const cld = new Cloudinary({
//   cloud: {
//     cloudName,
//   },
// });

export function cloudinaryImageWithPublidId(
  publicID: string,
  type: string,
  size?: number,
) {
  if (!cloudName) {
    return '';
  }
  if (size) {
    const scaleW = `c_scale,w_${(size ?? 150) * pixelRatio}`;
    return `https://res.cloudinary.com/${cloudName}/${type}/upload/${scaleW}/f_png/v1/${publicID}.png`;
  }
  return `https://res.cloudinary.com/${cloudName}/${type}/upload/f_png/v1/${publicID}.png`;
}

export function cloudinarySourceWithPublidId(
  publicID: string,
  type: string,
  size?: number,
) {
  if (!cloudName) {
    return '';
  }
  const scaleW = `c_scale,w_${size ?? 500}`;
  return `https://res.cloudinary.com/${cloudName}/${type}/upload/${scaleW}/v1/${publicID}`;
}
