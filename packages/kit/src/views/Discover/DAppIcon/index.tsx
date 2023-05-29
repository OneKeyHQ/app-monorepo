import type { ComponentProps, FC } from 'react';

import { Box, Icon, Image, NetImage } from '@onekeyhq/components';
import DAppIconBG from '@onekeyhq/kit/assets/DAppIcon_bg.png';
import multichainPNG from '@onekeyhq/kit/assets/dappIcon_multichain.png';

import { useNetworkSimple } from '../../../hooks';

type DAppSize = 24 | 28 | 38 | 48 | 40;
type DAppIconProps = {
  url?: string;
  size: DAppSize;
  networkIds?: string[];
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

type DAppNetworkIconProps = {
  networkIds: string[];
  size: DAppSize;
};

const DAppNetworkIcon: FC<DAppNetworkIconProps> = ({ networkIds, size }) => {
  const innerProps = sizeWithProps(size);
  const { chainIconPadding } = innerProps;
  const network = useNetworkSimple(networkIds[0]);
  if (networkIds.length > 1) {
    return (
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
          borderRadius="full"
        >
          <Image
            width={`${size * 0.2}px`}
            height={`${size * 0.2}px`}
            source={multichainPNG}
          />
        </Box>
      </>
    );
  }
  return (
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
          src={network?.logoURI}
          borderRadius="full"
        />
      </Box>
    </>
  );
};

const DAppIcon: FC<DAppIconProps> = ({ url, size, networkIds, ...rest }) => {
  const innerProps = sizeWithProps(size);
  const { innerSize, innerRadius, borderRadius } = innerProps;

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
        {url ? (
          <NetImage
            src={url}
            width={`${innerSize}px`}
            height={`${innerSize}px`}
            borderRadius={`${innerRadius}px`}
            bgColor="surface-neutral-default"
            fallbackElement={
              <Box
                borderRadius={12}
                justifyContent="center"
                alignItems="center"
                width={`${innerSize}px`}
                height={`${innerSize}px`}
              >
                <Icon size={16} name="GlobeAltMini" />
              </Box>
            }
          />
        ) : (
          <Box
            borderRadius={12}
            justifyContent="center"
            alignItems="center"
            width={`${innerSize}px`}
            height={`${innerSize}px`}
          >
            <Icon size={16} name="GlobeAltMini" />
          </Box>
        )}
        {networkIds && networkIds.length > 0 ? (
          <DAppNetworkIcon size={size} networkIds={networkIds} />
        ) : null}
      </Box>
    </Box>
  );
};

export default DAppIcon;
