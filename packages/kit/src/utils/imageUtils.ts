import { PixelRatio } from 'react-native';

import { CLOUNDINARY_NAME_KEY } from '../config';

const cloudName = CLOUNDINARY_NAME_KEY ?? 'dqesnqoqj';
const pixelRatio = PixelRatio.get();
const Folder = 'NFT/';

export function cloudinaryImageWithPublidId(
  publicID: string,
  type: string,
  size?: number,
) {
  // const url = cloudinary.url(Folder + publicID, {
  //   width: (size ?? 150) * pixelRatio,
  //   crop: 'scale',
  //   resource_type: type,
  //   transformation: [{ format: 'png', fetchFormat: 'png' }],
  // });
  // return `${url}.png`;

  const id = Folder + publicID;
  const width = (size ?? 150) * pixelRatio;
  const image = `https://res.cloudinary.com/${cloudName}/${type}/upload/c_scale,w_${width}/${id}.png`;
  return image;
}
