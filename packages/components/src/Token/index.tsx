import React, { FC } from 'react';
import { Image, Box, Center } from 'native-base';

import Typography from '../Typography';
import Icon from '../Icon';
import { CDN_PREFIX } from '../utils';

export type TokenProps = {
  src?: string;
  size?: number;
  className?: string | null;
  chain?: string;
  name?: string;
  description?: string;
  address?: string;
};

const defaultProps = {
  size: 10,
} as const;

const buildUrl = (src?: string, _chain = '', _address = '') => {
  const chain = _chain.toLocaleLowerCase();
  const address = _address.toLocaleLowerCase();
  if (src) return src;
  if (!chain) return null;
  if (chain && !address) return `${CDN_PREFIX}assets/${chain}/${chain}.png`;
  return `${CDN_PREFIX}assets/${chain}/${address}.png`;
};

const Token: FC<TokenProps> = ({
  src,
  size,
  chain,
  name,
  description,
  address,
}) => {
  const imageUrl = buildUrl(src, chain, address);
  return (
    <Box display="flex" flexDirection="row" alignItems="center">
      <Box mr="2">
        {imageUrl ? (
          <Image width={size} height={size} src={imageUrl} alt="Token" />
        ) : (
          <Center
            width={size}
            height={size}
            borderRadius="full"
            bg="background-selected"
          >
            <Icon name="QuestionMarkOutline" />
          </Center>
        )}
      </Box>
      {!!(name || description) && (
        <Box display="flex">
          {!!name && <Typography.Body1>{name}</Typography.Body1>}
          {!!description && <Typography.Body2>{description}</Typography.Body2>}
        </Box>
      )}
    </Box>
  );
};

Token.defaultProps = defaultProps;
export default Token;
