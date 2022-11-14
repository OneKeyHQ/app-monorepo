import React, {
  ComponentProps,
  FC,
  createElement,
  isValidElement,
  useMemo,
} from 'react';

import { Box, Center } from 'native-base';
import { ResponsiveValue } from 'native-base/lib/typescript/components/types';

import { parseNetworkId } from '@onekeyhq/engine/src/managers/network';
import { OnekeyNetwork } from '@onekeyhq/engine/src/presets/networkIds';
import { Token as IToken } from '@onekeyhq/engine/src/types/token';
import { useNavigation, useNetwork } from '@onekeyhq/kit/src/hooks';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';
import { ManageTokenRoutes } from '@onekeyhq/kit/src/views/ManageTokens/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Icon from '../Icon';
import Image from '../Image';
import Pressable from '../Pressable';
import { Body2, Text } from '../Typography';
import { shortenAddress } from '../utils';

export type TokenProps = {
  token?: Partial<IToken>;
  size?: ResponsiveValue<string | number>;
  name?: string;
  description?: string | JSX.Element | null;
  extra?: string;
  networkId?: string;

  nameProps?: ComponentProps<typeof Text>;
  descProps?: ComponentProps<typeof Body2>;
  extraProps?: ComponentProps<typeof Body2>;
  infoBoxProps?: ComponentProps<typeof Box>;

  showInfo?: boolean;
  showName?: boolean;
  showExtra?: boolean;
  showDescription?: boolean;
  showNetworkIcon?: boolean;
  showTokenVerifiedIcon?: boolean;
} & ComponentProps<typeof Box>;

const defaultProps = {
  size: 10,
} as const;

const getScaleRate = (size: ResponsiveValue<string | number>) => {
  const tokenSize = size || 8;
  const defaultIconSize =
    typeof tokenSize === 'number' ? tokenSize * 4 : parseInt(tokenSize as any);
  const rate = 9 / 12;
  if (Number.isNaN(defaultIconSize)) {
    return rate;
  }
  return (defaultIconSize * rate) / 32;
};

export const TokenVerifiedIcon: React.FC<{
  token?: Partial<IToken>;
  size?: number;
}> = ({ token, size = 16 }) => {
  const navigation = useNavigation();
  if (!token || (!token.verified && !token.security)) {
    return null;
  }

  const toVerifiedTokenPage = () => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.ManageToken,
      params: {
        screen: token.security
          ? ManageTokenRoutes.TokenRiskDetail
          : ManageTokenRoutes.VerifiedToken,
        params: {
          token: {
            ...token,
            ...parseNetworkId(token.networkId ?? ''),
          },
        },
      },
    });
  };

  return (
    <Pressable p="6px" onPress={toVerifiedTokenPage}>
      {token.security ? (
        <Icon size={size} name="ShieldExclamationSolid" color="icon-critical" />
      ) : (
        <Icon size={size} name="BadgeCheckSolid" color="icon-success" />
      )}
    </Pressable>
  );
};
const TokenIcon = ({
  size,
  token,
  showNetworkIcon,
}: Pick<TokenProps, 'size' | 'token' | 'showNetworkIcon'>) => {
  const { network } = useNetwork({ networkId: token?.networkId });
  const src = token?.logoURI;
  const letter = (token?.symbol || token?.name || '').slice(0, 4);
  const fallbackElement = useMemo(
    () =>
      letter ? (
        <Center
          width={size}
          height={size}
          borderRadius="full"
          bg="background-selected"
          overflow="hidden"
        >
          <Text
            fontSize={
              platformEnv.isRuntimeChrome
                ? '12px'
                : `${12 * getScaleRate(size)}px`
            }
            color="text-default"
            // @ts-ignore
            style={
              platformEnv.isRuntimeChrome
                ? {
                    display: 'inline-block',
                    'WebkitTransform': `scale(${getScaleRate(size)})`,
                  }
                : {}
            }
          >
            {letter.toUpperCase()}
          </Text>
        </Center>
      ) : (
        <Center
          width={size}
          height={size}
          borderRadius="full"
          bg="background-selected"
        >
          <Icon name="QuestionMarkOutline" />
        </Center>
      ),
    [size, letter],
  );

  const networkIcon = useMemo(() => {
    if (!showNetworkIcon) {
      return null;
    }
    if (!network?.logoURI) {
      return null;
    }
    if (network.id === OnekeyNetwork.eth) {
      return null;
    }
    return (
      <Image
        width="18px"
        height="18px"
        src={network.logoURI}
        alt={network.logoURI}
        borderRadius="full"
        borderWidth="2px"
        borderColor="surface-subdued"
        position="absolute"
        top="-4px"
        right="-4px"
      />
    );
  }, [network, showNetworkIcon]);

  return (
    <Box width={size} height={size} position="relative">
      {src ? (
        <Image
          width={size}
          height={size}
          src={src}
          key={src}
          fallbackElement={fallbackElement}
          alt={src}
          borderRadius="full"
        />
      ) : (
        fallbackElement
      )}
      {networkIcon}
    </Box>
  );
};

const renderEle = (
  content: string | JSX.Element | undefined | null,
  ele: any,
  props: any,
) => {
  if (!content) {
    return null;
  }
  if (isValidElement(ele)) {
    return ele;
  }
  return createElement(ele, props, content);
};

const Token: FC<TokenProps> = ({
  token,
  size,
  name,
  description,
  extra,

  nameProps,
  descProps,
  infoBoxProps,
  extraProps: addressProps,

  showName = true,
  showInfo = false,
  showExtra = false,
  showDescription = true,
  showNetworkIcon = false,
  showTokenVerifiedIcon = true,

  ...boxProps
}) => {
  const { address, symbol } = token || {};

  const nameView = useMemo(() => {
    if (!showName && !name) {
      return null;
    }
    if (!name && !token?.name) {
      return null;
    }
    const dom = renderEle(name || token?.name, Text, {
      typography: { sm: 'Body1Strong', md: 'Body2Strong' },
      isTruncated: true,
      maxW: 56,
      numberOfLines: 1,
      ...nameProps,
    });
    if (!showTokenVerifiedIcon || (!token?.verified && !token?.security)) {
      return dom;
    }
    return (
      <Box flexDirection="row" alignItems="center">
        {dom} <TokenVerifiedIcon size={16} token={token} />
      </Box>
    );
  }, [name, token, nameProps, showName, showTokenVerifiedIcon]);

  const descView = useMemo(() => {
    if (!showDescription && !description) {
      return null;
    }
    if (!description && !symbol) {
      return null;
    }
    return renderEle(description || symbol, Body2, {
      color: 'text-subdued',
      maxW: 56,
      numberOfLines: 1,
      ...descProps,
    });
  }, [descProps, description, symbol, showDescription]);

  const extraView = useMemo(() => {
    if (!showExtra && !extra) {
      return null;
    }
    if (!extra && !address) {
      return null;
    }
    return renderEle(extra || shortenAddress(address || ''), Body2, {
      color: 'text-subdued',
      maxW: 56,
      numberOfLines: 1,
      ...addressProps,
    });
  }, [address, addressProps, extra, showExtra]);
  return (
    <Box display="flex" flexDirection="row" alignItems="center" {...boxProps}>
      <TokenIcon size={size} token={token} showNetworkIcon={showNetworkIcon} />
      {showInfo && (
        <Box display="flex" ml="3" {...infoBoxProps}>
          {nameView}
          {descView}
          {extraView}
        </Box>
      )}
    </Box>
  );
};

Token.defaultProps = defaultProps;

export default Token;
