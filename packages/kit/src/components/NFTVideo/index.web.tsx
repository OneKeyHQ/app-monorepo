import type { FC } from 'react';

import ReactPlayer from 'react-player';

import { Box } from '@onekeyhq/components';

type Props = {
  size: number;
  url: string;
};
const NFTVideo: FC<Props> = ({ url, size }) => (
  <Box size={`${size}px`}>
    <ReactPlayer
      width={size}
      height={size}
      url={url}
      loop
      playing
      controls
      muted
    />
  </Box>
);

export default NFTVideo;
