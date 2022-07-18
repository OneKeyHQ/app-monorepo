import React, {
  ComponentProps,
  FC,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import axios from 'axios';

import { Box, Center, Image, NetImage, Spinner } from '@onekeyhq/components';
import NFTEmptyImg from '@onekeyhq/components/img/nft_empty.png';
import { getImageWithAsset } from '@onekeyhq/engine/src/managers/moralis';
import type { MoralisNFT } from '@onekeyhq/engine/src/types/moralis';

type Props = {
  asset: MoralisNFT;
  size: number;
} & ComponentProps<typeof Box>;

const useValidImageUrl = (url: string) => {
  const maxRetryCount = 5;
  const [retryCount, updateCount] = useState(0);
  const [isValid, setIsValid] = useState(false);
  const checkUrl = useCallback(async () => {
    if (url === '') {
      return;
    }
    const contentType = await axios
      .head(url, { timeout: 1000 })
      .then((resp) => resp.headers['content-type'])
      .catch(() => '404');
    const valid = contentType.startsWith('image');
    const timeOut = Math.floor(retryCount / 5 + 1) * 5000;
    setIsValid(valid);
    setTimeout(() => {
      if (!valid) {
        updateCount((prev) => prev + 1);
      }
    }, timeOut);
  }, [retryCount, url]);

  useEffect(() => {
    if (!isValid && retryCount < maxRetryCount) {
      checkUrl();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkUrl, isValid]);

  return useMemo(() => {
    if (url === '') {
      return '';
    }
    if (isValid) {
      return url;
    }
    if (retryCount < maxRetryCount && !isValid) {
      return 'loading';
    }
    return '';
  }, [isValid, retryCount, url]);
};

const CollectibleListImage: FC<Props> = ({ asset, size, ...props }) => {
  const imageUrl = getImageWithAsset(asset, 150);
  const url = useValidImageUrl(imageUrl);

  if (url === 'loading') {
    return (
      <Center size={`${size}px`} {...props}>
        <Spinner size="sm" />
      </Center>
    );
  }
  if (url === '') {
    return (
      <Center size={`${size}px`} {...props} overflow="hidden">
        <Image size={`${size}px`} source={NFTEmptyImg} />
      </Center>
    );
  }
  return (
    <Box size={`${size}px`} {...props} overflow="hidden">
      <NetImage width={size} height={size} uri={url} />
    </Box>
  );
};

export default CollectibleListImage;
