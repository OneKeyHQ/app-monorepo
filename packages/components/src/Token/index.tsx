import React, {
  ComponentProps,
  FC,
  createElement,
  isValidElement,
  useMemo,
} from 'react';

import { Box, Center, Column, Row, ZStack } from 'native-base';

import { OnekeyNetwork } from '@onekeyhq/engine/src/presets/networkIds';
import { Token as IToken } from '@onekeyhq/engine/src/types/token';
import { useNavigation, useNetwork } from '@onekeyhq/kit/src/hooks';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';
import { ManageTokenRoutes } from '@onekeyhq/kit/src/views/ManageTokens/types';

import Icon from '../Icon';
import Image from '../Image';
import Pressable from '../Pressable';
import { useThemeValue } from '../Provider/hooks';
import Typography, { Body2, Text } from '../Typography';
import { CDN_PREFIX } from '../utils';

import type { ResponsiveValue } from 'native-base/lib/typescript/components/types';

export type TokenProps = {
  src?: string;
  size?: ResponsiveValue<string | number>;
  chain?: string;
  name?: string;
  description?: string | JSX.Element | null;
  address?: string;
  letter?: string;
  networkId?: string;

  nameProps?: ComponentProps<typeof Text>;
  descProps?: ComponentProps<typeof Body2>;
  addressProps?: ComponentProps<typeof Body2>;

  withDetail?: boolean;
};

const defaultProps = {
  size: 10,
} as const;

const buildUrl = (src?: string, _chain = '', _address = '') => {
  const chain = _chain.toLowerCase();
  const address = _address.toLowerCase();
  if (src) return src;
  if (!chain) return null;
  if (chain && !address) return `${CDN_PREFIX}assets/${chain}/${chain}.png`;
  return `${CDN_PREFIX}assets/${chain}/${address}.png`;
};

const TokenIcon = ({
  src,
  size,
  networkId,
  letter,
}: {
  src: string;
} & Pick<TokenProps, 'networkId' | 'size' | 'letter'>) => {
  const network = useNetwork(networkId);
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
          <Text fontSize="9px" color="text-default" numberOfLines={1}>
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
  }, [network]);

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
  src,
  size,
  chain,
  name,
  description,
  address,
  letter,
  networkId,

  nameProps,
  descProps,
  addressProps,
  withDetail,
}) => {
  const imageUrl = buildUrl(src, chain, address);
  return (
    <Box display="flex" flexDirection="row" alignItems="center">
      <TokenIcon
        src={imageUrl || ''}
        size={size}
        letter={(letter || name || '')?.slice(0, 4).trim()}
        networkId={networkId}
      />
      {withDetail && (
        <Box display="flex" ml="3">
          {renderEle(name, Text, {
            typography: { sm: 'Body1Strong', md: 'Body2Strong' },
            isTruncated: true,
            maxW: 56,
            numberOfLines: 1,
            ...nameProps,
          })}
          {renderEle(description, Body2, {
            color: 'text-subdued',
            maxW: 56,
            numberOfLines: 1,
            ...descProps,
          })}
          {renderEle(address, Body2, {
            color: 'text-subdued',
            maxW: 56,
            numberOfLines: 1,
            ...addressProps,
          })}
        </Box>
      )}
    </Box>
  );
};

Token.defaultProps = defaultProps;

type TokenGroupSize = 'md' | 'lg' | 'xl';
export type TokenGroupProps = {
  tokens: TokenProps[];
  size: TokenGroupSize;
  cornerToken?: TokenProps;
  name?: string;
  description?: string;
};

type GroupTypeProps = {
  groupSize: number;
  mlArray: string[];
  groupTokenWidth: number[];
  cornerTokenSize: number;
};

const mdProps: GroupTypeProps = {
  groupSize: 24,
  mlArray: ['0px', '20px', '40px', '60px'],
  groupTokenWidth: [28, 48, 68, 88],
  cornerTokenSize: 12,
};

const lgProps: GroupTypeProps = {
  groupSize: 32,
  mlArray: ['0px', '24px', '48px', '72px'],
  groupTokenWidth: [36, 60, 84, 108],
  cornerTokenSize: 16,
};

const xlProps: GroupTypeProps = {
  groupSize: 40,
  mlArray: ['0px', '32px', '64px', '96px'],
  groupTokenWidth: [44, 76, 108, 140],
  cornerTokenSize: 20,
};

function propWithSize(size: TokenGroupSize) {
  switch (size) {
    case 'md':
      return mdProps;
    case 'lg':
      return lgProps;
    default:
      return xlProps;
  }
}

function groupHeight(size: TokenGroupSize, cornerToken?: TokenProps): number {
  const hasCorner = cornerToken != null;
  switch (size) {
    case 'md':
      return hasCorner ? 32 : 28;
    case 'lg':
      return hasCorner ? 41 : 36;
    default:
      return hasCorner ? 50 : 44;
  }
}

function groupTokenWidth(
  tokens: TokenProps[],
  size: TokenGroupSize,
  cornerToken?: TokenProps,
): number {
  const hasCorner = cornerToken != null;
  let width = 0;
  switch (size) {
    case 'md':
      width = mdProps.groupTokenWidth[tokens.length - 1];
      return hasCorner ? width + 4 : width;
    case 'lg':
      width = lgProps.groupTokenWidth[tokens.length - 1];
      return hasCorner ? width + 5 : width;
    default:
      width = xlProps.groupTokenWidth[tokens.length - 1];
      return hasCorner ? width + 6 : width;
  }
}

type GroupTokenArray =
  | [TokenProps]
  | [TokenProps, TokenProps]
  | [TokenProps, TokenProps, TokenProps]
  | [TokenProps, TokenProps, TokenProps, TokenProps];
interface TokensViewProps {
  groupTokens: GroupTokenArray;
  size: TokenGroupSize;
  cornerToken?: TokenProps;
}

const TokensView = ({ groupTokens, size, cornerToken }: TokensViewProps) => {
  const groupProps = propWithSize(size);
  const borderColor = useThemeValue('surface-subdued');
  const width = groupTokenWidth(groupTokens, size, cornerToken);
  const hasCorner = cornerToken != null;

  // Only show 4 of the tokens
  const tokenList = useMemo(() => {
    if (groupTokens?.length > 0) {
      return groupTokens.slice(0, 4).map((token, index) => {
        const height = groupHeight(size, cornerToken);
        const mt = (height - groupProps.groupSize) / 2;

        return (
          <Box
            mt={`${hasCorner ? mt : 0}px`}
            ml={groupProps.mlArray[index]}
            borderWidth="2px"
            borderColor={borderColor}
            borderRadius="full"
            padding={0}
            key={`tokenGroup-${index}`}
          >
            <Token
              chain={token.chain}
              size={`${groupProps.groupSize}px`}
              name={token.name}
            />
          </Box>
        );
      });
    }
    return null;
  }, [
    groupTokens,
    size,
    cornerToken,
    borderColor,
    hasCorner,
    groupProps.groupSize,
    groupProps.mlArray,
  ]);

  const cornerTokenView = hasCorner ? (
    <Box
      mt={0}
      ml={`${width - groupProps.cornerTokenSize - 4}px`}
      borderWidth="2px"
      borderColor={borderColor}
      borderRadius="full"
      padding={0}
      key={5}
    >
      <Token
        chain={cornerToken.chain}
        size={`${groupProps.cornerTokenSize}px`}
        name={cornerToken.name}
      />
    </Box>
  ) : null;

  return (
    <ZStack mt="0" ml={0} width={`${width}px`}>
      {tokenList}
      {cornerTokenView}
    </ZStack>
  );
};

export const TokenVerifiedIcon: React.FC<{
  token?: Partial<IToken>;
  size?: number;
}> = ({ token, size = 16 }) => {
  const navigation = useNavigation();
  if (!token || !token.verified) {
    return null;
  }

  const toVerifiedTokenPage = () => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.ManageToken,
      params: {
        screen: ManageTokenRoutes.VerifiedToken,
        params: {
          source: token.source || [],
        },
      },
    });
  };
  return (
    <Pressable p="6px" onPress={toVerifiedTokenPage}>
      <Icon size={size} name="BadgeCheckSolid" color="icon-success" />
    </Pressable>
  );
};

export const TokenGroup: FC<TokenGroupProps> = ({
  tokens,
  size,
  cornerToken,
  name,
  description,
}) => {
  const height = groupHeight(size, cornerToken);
  const descColor = useThemeValue('text-subdued');
  const hasCorner = cornerToken != null;
  let space = size === 'md' ? 12 : 16;
  if (hasCorner) {
    space -= 4;
  }
  return (
    <Row height={`${height}px`} width="auto">
      <TokensView
        groupTokens={tokens as GroupTokenArray}
        size={size}
        cornerToken={cornerToken}
      />
      {!!(name || description) && (
        <Column
          justifyContent="center"
          ml={`${space}px`}
          height={`${height}px`}
        >
          {!!name &&
            (size === 'xl' ? (
              <Typography.Body1>{name}</Typography.Body1>
            ) : (
              <Typography.Body2>{name}</Typography.Body2>
            ))}
          {!!description && (
            <Typography.Body2 color={descColor}>{description}</Typography.Body2>
          )}
        </Column>
      )}
    </Row>
  );
};

export default Token;
