import type { ComponentProps, FC } from 'react';
import {
  createElement,
  isValidElement,
  memo,
  useCallback,
  useMemo,
} from 'react';

import { Box, Center } from 'native-base';
import { useIntl } from 'react-intl';

import { parseNetworkId } from '@onekeyhq/engine/src/managers/network';
import type { Token as IToken } from '@onekeyhq/engine/src/types/token';
import { TokenRiskLevel } from '@onekeyhq/engine/src/types/token';
import { useNetwork } from '@onekeyhq/kit/src/hooks';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  ManageTokenModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Icon from '../Icon';
import Image from '../Image';
import Pressable from '../Pressable';
import Text from '../Text';
import ToastManager from '../ToastManager';
import { Body2 } from '../Typography';
import { shortenAddress } from '../utils';

import type { ResponsiveValue } from 'native-base/lib/typescript/components/types';

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
  verifyIconSize?: number;

  showInfo?: boolean;
  showName?: boolean;
  showExtra?: boolean;
  showDescription?: boolean;
  showNetworkIcon?: boolean;
  showTokenVerifiedIcon?: boolean;
  showIconBorder?: boolean;
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

export const SecurityIcon: FC<{ token: Partial<IToken>; size: number }> = ({
  token,
  size,
}) => {
  const { riskLevel } = token;
  if (!riskLevel || riskLevel < TokenRiskLevel.VERIFIED) {
    return null;
  }
  if (riskLevel === TokenRiskLevel.DANGER) {
    return (
      <Icon size={size} name="ExclamationTriangleMini" color="icon-warning" />
    );
  }
  if (riskLevel === TokenRiskLevel.WARN) {
    return (
      <Icon size={size} name="ExclamationCircleMini" color="icon-subdued" />
    );
  }
  return null;
};

export const TokenVerifiedIcon: FC<{
  token?: Partial<IToken>;
  size?: number;
}> = ({ token, size = 16 }) => {
  const intl = useIntl();

  const navigation = useAppNavigation();

  const icon = useMemo(() => {
    if (!token?.riskLevel) {
      if (token?.isNative) {
        return <Icon size={size} name="BadgeCheckMini" color="icon-success" />;
      }
      return null;
    }
    if (token?.riskLevel > TokenRiskLevel.VERIFIED) {
      return <SecurityIcon token={token} size={size} />;
    }
    if (token?.riskLevel === TokenRiskLevel.VERIFIED) {
      return <Icon size={size} name="BadgeCheckMini" color="icon-success" />;
    }
    return null;
  }, [token, size]);

  const toVerifiedTokenPage = useCallback(() => {
    if (token?.isNative) {
      ToastManager.show(
        {
          title: intl.formatMessage({
            id: 'msg__this_is_the_native_token_of_the_mainnet',
          }),
        },
        {
          type: 'default',
        },
      );
      return;
    }
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.ManageToken,
      params: {
        screen:
          typeof token?.riskLevel === 'number' &&
          token?.riskLevel > TokenRiskLevel.VERIFIED
            ? ManageTokenModalRoutes.TokenRiskDetail
            : ManageTokenModalRoutes.VerifiedToken,
        params: {
          token: {
            ...token,
            ...parseNetworkId(token?.networkId ?? ''),
          },
        },
      },
    });
  }, [navigation, token, intl]);

  if (!token || (!token.riskLevel && !token?.isNative)) {
    return null;
  }

  return (
    <Pressable p="6px" ml="-6px" onPress={toVerifiedTokenPage}>
      {icon}
    </Pressable>
  );
};

const borderProps = {
  borderRadius: 'full',
  borderWidth: '2px',
  borderColor: 'surface-subdued',
};

export const TokenIcon = ({
  size,
  token,
  showNetworkIcon,
  showIconBorder,
  ...boxProps
}: Pick<TokenProps, 'size' | 'token' | 'showNetworkIcon' | 'showIconBorder'> &
  ComponentProps<typeof Box>) => {
  const { network } = useNetwork({ networkId: token?.networkId });
  const src = token?.logoURI;
  const letter = (token?.symbol || token?.name || '').slice(0, 4);
  const fallbackElement = useMemo(
    () =>
      letter ? (
        <Center
          width="full"
          height="full"
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
          width="full"
          height="full"
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
        position="absolute"
        top="-4px"
        right="-4px"
        {...borderProps}
      />
    );
  }, [network, showNetworkIcon]);

  return (
    <Box
      width={size}
      height={size}
      position="relative"
      {...(showIconBorder ? borderProps : {})}
      {...boxProps}
    >
      {src ? (
        <Image
          width={showIconBorder ? 'full' : size}
          height={showIconBorder ? 'full' : size}
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

  verifyIconSize = 16,
  showName = true,
  showInfo = false,
  showExtra = false,
  showDescription = true,
  showNetworkIcon = false,
  showIconBorder = false,
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
    if (!showTokenVerifiedIcon || (!token?.riskLevel && !token?.isNative)) {
      return dom;
    }
    return (
      <Box flexDirection="row" alignItems="center">
        {dom} <TokenVerifiedIcon size={verifyIconSize ?? 16} token={token} />
      </Box>
    );
  }, [name, token, nameProps, showName, showTokenVerifiedIcon, verifyIconSize]);

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
      <TokenIcon
        size={size}
        token={token}
        showIconBorder={showIconBorder}
        showNetworkIcon={showNetworkIcon}
      />
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

export default memo(Token);
