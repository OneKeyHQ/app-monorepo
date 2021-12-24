import React, { FC, useMemo } from 'react';

import { Box, Center, Column, Image, Row, ZStack } from 'native-base';

import Icon from '../Icon';
import { useThemeValue } from '../Provider/hooks';
import Typography from '../Typography';
import { CDN_PREFIX } from '../utils';

export type TokenProps = {
  src?: string;
  size?: number | string;
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
  const fallbackElement = useMemo(
    () => (
      <Center
        width={size}
        height={size}
        borderRadius="full"
        bg="background-selected"
      >
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
      {!!(name || description) && (
        <Box display="flex" ml="2">
          {!!name && <Typography.Body1>{name}</Typography.Body1>}
          {!!description && <Typography.Body2>{description}</Typography.Body2>}
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
            <Token chain={token.chain} size={`${groupProps.groupSize}px`} />
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
