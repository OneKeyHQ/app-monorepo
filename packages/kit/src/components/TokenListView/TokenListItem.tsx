import { Icon, Stack, XStack } from '@onekeyhq/components';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { TokenBalanceView } from './TokenBalanceView';
import { TokenNameView } from './TokenNameView';
import { TokenPriceChangeView } from './TokenPriceChangeView';
import { TokenPriceView } from './TokenPriceView';
import { TokenValueView } from './TokenValueView';

type IProps = {
  index: number;
  token: IAccountToken;
  onPress?: (token: IAccountToken) => void;
  tableLayout?: boolean;
  withPrice?: boolean;
} & Omit<IListItemProps, 'onPress'>;

function TokenListItem(props: IProps) {
  const { index, token, onPress, tableLayout, withPrice, ...rest } = props;

  return (
    <ListItem
      key={token.name}
      avatarProps={{
        src: token.logoURI,
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
      backgroundColor={tableLayout && index % 2 === 0 ? '$bgSubdued' : ''}
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
        <XStack
          alignItems="center"
          {...(tableLayout && {
            w: '$56',
            textAlign: 'left',
            $gtXl: {
              w: '$72',
            },
          })}
        >
          <TokenNameView
            size="$bodyLgMedium"
            numberOfLines={1}
            name={token.name}
            isNative={token.isNative}
            {...(tableLayout && {
              size: '$bodyMdMedium',
            })}
          />
        </XStack>
        <TokenBalanceView
          size="$bodyMd"
          color="$textSubdued"
          $key={token.$key ?? ''}
          symbol={token.symbol}
          textAlign="left"
          {...(tableLayout && {
            color: '$text',
            w: '$52',
            $gtXl: {
              w: '$72',
            },
          })}
        />
      </Stack>

      <Stack
        flexDirection="column-reverse"
        alignItems="flex-end"
        {...(tableLayout && {
          flex: 1,
          flexDirection: 'row',
          space: '$3',
        })}
      >
        {withPrice && (
          <XStack
            space="$2"
            alignItems="center"
            {...(tableLayout && {
              w: '$52',
              textAlign: 'left',
              $gtXl: {
                w: '$72',
              },
            })}
          >
            {tableLayout && (
              <TokenPriceView $key={token.$key ?? ''} size="$bodyMd" />
            )}
            <TokenPriceChangeView
              $key={token.$key ?? ''}
              size="$bodyMd"
              {...(tableLayout && {
                w: '$24',
                textAlign: 'left',
              })}
            />
          </XStack>
        )}
        <TokenValueView
          $key={token.$key ?? ''}
          size="$bodyLgMedium"
          textAlign="right"
          {...(tableLayout && {
            flex: 1,
            size: '$bodyMd',
          })}
        />
      </Stack>
    </ListItem>
  );
}

export { TokenListItem };
