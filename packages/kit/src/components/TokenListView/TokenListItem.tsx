import type { IListItemProps } from '@onekeyhq/components';
import { Icon, ListItem, Stack, XStack } from '@onekeyhq/components';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { TokenBalanceView } from './TokenBalanceView';
import { TokenPriceChangeView } from './TokenPriceChangeView';
import { TokenPriceView } from './TokenPriceView';
import { TokenSymbolView } from './TokenSymbolView';
import { TokenValueView } from './TokenValueView';

type IProps = {
  token: IAccountToken;
  onPress?: (token: IAccountToken) => void;
  tableLayout?: boolean;
};

function TokenListItem(props: IProps & Omit<IListItemProps, 'onPress'>) {
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
        ...(tokenInfo.isNative && {
          cornerIconProps: {
            name: 'GasSolid',
            size: '$3.5',
            containerProps: {
              borderRadius: 4,
            },
          },
        }),
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
        <TokenSymbolView
          size="$bodyLgMedium"
          numberOfLines={1}
          {...(tableLayout && {
            w: '$32',
          })}
          symbol={tokenInfo.symbol}
        />

        <XStack space="$2">
          <TokenPriceView
            size="$bodyMd"
            color="$textSubdued"
            $key={token.$key ?? ''}
            {...(tableLayout && {
              size: '$bodyLg',
              color: '$text',
              w: '$32',
              textAlign: 'right',
              $gtXl: {
                w: '$56',
              },
              $gt2xl: {
                w: '$72',
              },
            })}
          />
          <TokenPriceChangeView
            $key={token.$key ?? ''}
            size="$bodyMd"
            {...(tableLayout && {
              size: '$bodyLg',
              w: '$24',
            })}
          />
        </XStack>
      </Stack>

      <Stack
        {...(tableLayout && {
          flex: 1,
          flexDirection: 'row',
          space: '$3',
        })}
      >
        <TokenBalanceView
          size="$bodyLgMedium"
          $key={token.$key ?? ''}
          textAlign="right"
          {...(tableLayout && {
            w: '$36',
            $gtXl: {
              w: '$56',
            },
            $gt2xl: {
              w: '$72',
            },
          })}
        />
        <TokenValueView
          $key={token.$key ?? ''}
          color="$textSubdued"
          size="$bodyMd"
          textAlign="right"
          {...(tableLayout && {
            flex: 1,
            color: '$text',
            size: '$bodyLgMedium',
          })}
        />
      </Stack>
    </ListItem>
  );
}

export { TokenListItem };
