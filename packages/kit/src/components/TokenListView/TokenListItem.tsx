import type { IListItemProps } from '@onekeyhq/components';
import {
  Icon,
  ListItem,
  SizableText,
  Stack,
  useMedia,
} from '@onekeyhq/components';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { TokenBalanceView } from './TokenBalanceView';
// import { TokenPriceView } from './TokenPriceView';
// import { TokenValueView } from './TokenValueView';

type IProps = {
  token: IAccountToken;
  onPress?: (token: IAccountToken) => void;
  tableLayout?: boolean;
};

function TokenListItem(props: IProps & Omit<IListItemProps, 'onPress'>) {
  const media = useMedia();
  const { token, onPress, tableLayout, ...rest } = props;
  const tokenInfo = token.info;
  return (
    <ListItem
      key={tokenInfo.name}
      avatarProps={{
        src: tokenInfo.logoURI,
        circular: true,
        fallbackProps: {
          bg: '$bgStrong',
          justifyContent: 'center',
          alignItems: 'center',
          children: <Icon name="ImageMountainSolid" />,
        },
        ...(tableLayout && {
          size: '$8',
        }),
      }}
      userSelect="none"
      onPress={() => {
        onPress?.(token);
      }}
      {...rest}
    >
      <Stack
        {...(tableLayout
          ? {
              flexDirection: 'row',
              space: '$3',
            }
          : {
              flex: 1,
            })}
      >
        {/* name */}
        <SizableText
          size="$bodyLgMedium"
          numberOfLines={1}
          {...(tableLayout && {
            w: '$56',
            $gt2xl: {
              w: '$72',
            },
          })}
        >
          {tokenInfo.name}
        </SizableText>

        {/* balance */}
        <TokenBalanceView
          size="$bodyMd"
          color="$textSubdued"
          $key={token.$key ?? ''}
          symbol={tokenInfo.symbol}
          {...(tableLayout && {
            size: '$bodyLg',
            color: '$text',
            w: '$48',
            $gt2xl: {
              w: '$72',
            },
          })}
        />
      </Stack>

      {/* price */}
      {tableLayout && media.gtXl && (
        <SizableText
          w="$40"
          $gt2xl={{
            w: '$72',
          }}
          textAlign="right"
          numberOfLines={1}
        >
          $23456.78
        </SizableText>
      )}

      <Stack
        {...(tableLayout && {
          flex: 1,
          flexDirection: 'row-reverse',
          space: '$3',
        })}
      >
        {/* value */}
        <SizableText
          size="$bodyLgMedium"
          textAlign="right"
          {...(tableLayout && {
            flex: 1,
          })}
        >
          $1000.00
        </SizableText>

        {/*
          change
          1. +x.xx% is positive (textSuccess)
          2. -x.xx% is negative (textCritical)
          3. 0.00% is neutral (textSubdued)
        */}
        <SizableText
          size="$bodyMd"
          color="$textSuccess"
          textAlign="right"
          {...(tableLayout && {
            size: '$bodyLg',
          })}
        >
          +5.00%
        </SizableText>
      </Stack>
    </ListItem>
  );
}

export { TokenListItem };
