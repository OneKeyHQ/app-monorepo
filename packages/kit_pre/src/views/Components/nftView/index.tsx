import type { FC } from 'react';
import { useMemo } from 'react';

import { Box, Center, Image } from 'native-base';

import { Icon } from '@onekeyhq/components';

import type { ResponsiveValue } from 'native-base/lib/typescript/components/types';

export type NFTViewProps = {
  src?: string;
  size?: ResponsiveValue<string | number>;
  // eslint-disable-next-line react/no-unused-prop-types
  id?: string | null;
  // eslint-disable-next-line react/no-unused-prop-types
  chain?: string;
};

const defaultProps = {
  size: 10,
} as const;

const NFTView: FC<NFTViewProps> = ({ src, size }) => {
  const imageUrl = src;
  const fallbackElement = useMemo(
    () => (
      <Center width={size} height={size} bg="background-selected">
        <Icon name="QuestionMarkOutline" />
      </Center>
    ),
    [size],
  );
  return (
    <Box display="flex" flexDirection="row" alignItems="center">
      <Box>
        {imageUrl ? (
          <Image
            width={size}
            height={size}
            src={imageUrl}
            key={imageUrl}
            fallbackElement={fallbackElement}
            alt={imageUrl}
          />
        ) : (
          fallbackElement
        )}
      </Box>
    </Box>
  );
};

NFTView.defaultProps = defaultProps;
export default NFTView;
