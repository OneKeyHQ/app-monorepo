import { Cloudinary } from '@cloudinary/url-gen';
import { scale } from '@cloudinary/url-gen/actions/resize';
import { PixelRatio } from 'react-native';

import { CLOUNDINARY_NAME_KEY } from '../config';

const cloudName = CLOUNDINARY_NAME_KEY;
const pixelRatio = PixelRatio.get();

const cld = new Cloudinary({
  cloud: {
    cloudName,
  },
});

export function cloudinaryImageWithPublidId(
  publicID: string,
  type: string,
  format: string,
  size?: number,
) {
  if (!cloudName) {
    return '';
  }
  if (type === 'image') {
    return cld
      .image(publicID)
      .resize(scale().width((size ?? 150) * pixelRatio))
      .format('png')
      .toURL();
  }
  return cld
    .video(publicID)
    .resize(scale().width((size ?? 150) * pixelRatio))
    .format('png')
    .toURL();
}

export function cloudinaryVideoWithPublidId(publicID: string, size?: number) {
  if (!cloudName) {
    return '';
  }
  return cld
    .video(publicID)
    .resize(scale().width(size ?? 500))
    .toURL();
}
