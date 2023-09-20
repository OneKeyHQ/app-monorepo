import type { FC } from 'react';

import { Center, Image, NetImage } from '@onekeyhq/components';

type Props = {
  size: number;
  url: string;
};

const SVGImage: FC<Props> = ({ ...rest }) => {
  const { url, size } = rest;
  const isHttpUrl = !url?.startsWith('data:image/svg+xml');
  return (
    <Center size={size} borderRadius="20px" overflow="hidden">
      {isHttpUrl ? (
        <NetImage
          width={`${size}px`}
          height={`${size}px`}
          resizeMode="contain"
          skeleton
          src={url}
        />
      ) : (
        <Image
          width={`${size}px`}
          height={`${size}px`}
          resizeMode="contain"
          source={{ uri: url }}
        />
      )}
    </Center>
  );
};

const NFTSVG: FC<Props> = ({ ...rest }) => <SVGImage {...rest} />;

export default NFTSVG;
