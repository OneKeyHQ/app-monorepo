import React, { ComponentProps, FC } from 'react';

import { Box, Image, NetImage } from '@onekeyhq/components';
import { CDN_PREFIX } from '@onekeyhq/components/src/utils';
import DAppIconBG from '@onekeyhq/kit/assets/DAppIcon_bg.png';

import { imageUrl } from '../Service';

const chainUrl = (id: string) => {
  const chain = id.toLocaleLowerCase();
  return `${CDN_PREFIX}assets/${chain}/${chain}.png`;
};
type DAppSize = 24 | 28 | 38 | 48 | 40;
type DAppIconProps = {
  favicon: string;
  chain?: string;
  size: DAppSize;
} & ComponentProps<typeof Box>;

export type InnerProps = {
  innerSize: number;
  borderRadius: number;
  innerRadius: number;
  chainIconPadding?: number;
} & ComponentProps<typeof Box>;

function sizeWithProps(size: DAppSize): InnerProps {
  const propsMap: Record<DAppSize, InnerProps> = {
    24: {
      borderRadius: 8,
      innerSize: 22,
      innerRadius: 6,
      chainIconPadding: 1.57,
    },
    28: {
      borderRadius: 9,
      innerSize: 25,
      innerRadius: 6,
      chainIconPadding: 1.57,
    },
    38: {
      borderRadius: 10,
      innerSize: 36,
      innerRadius: 10,
      chainIconPadding: 1.57,
    },
    40: {
      borderRadius: 12,
      innerSize: 36,
      innerRadius: 10,
      chainIconPadding: 1.57,
    },
    48: {
      borderRadius: 12,
      innerSize: 44,
      innerRadius: 10,
      chainIconPadding: 2.69,
    },
  };
  return propsMap[size];
}

const DAppIcon: FC<DAppIconProps> = ({ favicon, chain, size, ...rest }) => {
  const innerProps = sizeWithProps(size);
  const { innerSize, innerRadius, borderRadius, chainIconPadding } = innerProps;
  const url = imageUrl(favicon);

  return (
    <Box
      justifyContent="center"
      alignItems="center"
      width={`${size}px`}
      height={`${size}px`}
      borderRadius={`${borderRadius}px`}
      borderWidth="1px"
      borderColor="border-subdued"
      {...rest}
    >
      <Box width={`${innerSize}px`} height={`${innerSize}px`}>
        <NetImage
          uri={url}
          size={`${innerSize}px`}
          borderRadius={innerRadius}
        />
        {!!chain && (
          <>
            <Image
              position="absolute"
              bottom="0.1px"
              right="0.1px"
              width={`${size * 0.625}px`}
              height={`${size * 0.4375}px`}
              source={DAppIconBG}
            />
            <Box
              position="absolute"
              bottom={`${chainIconPadding ?? 0}px`}
              right={`${chainIconPadding ?? 0}px`}
            >
              <NetImage
                width={`${size * 0.2}px`}
                height={`${size * 0.2}px`}
                uri={chainUrl(chain)}
              />
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};

export default DAppIcon;
