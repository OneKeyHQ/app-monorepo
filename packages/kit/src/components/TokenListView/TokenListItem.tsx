import { Stack, XStack } from '@onekeyhq/components';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { Token } from '../Token';

import { TokenBalanceView } from './TokenBalanceView';
import { TokenNameView } from './TokenNameView';
import { TokenPriceChangeView } from './TokenPriceChangeView';
import { TokenPriceView } from './TokenPriceView';
import { TokenValueView } from './TokenValueView';

export type ITokenListItemProps = {
  index: number;
  token: IAccountToken;
  onPress?: (token: IAccountToken) => void;
  tableLayout?: boolean;
  withPrice?: boolean;
} & Omit<IListItemProps, 'onPress'>;

function TokenListItem(props: ITokenListItemProps) {
  const { index, token, onPress, tableLayout, withPrice, ...rest } = props;

  return (
    <ListItem
      key={token.name}
      userSelect="none"
      onPress={() => {
        onPress?.(token);
      }}
      // {...(tableLayout &&
      //   index % 2 === 1 && {
      //     bg: '$bgSubdued',
      //   })}
      {...rest}
    >
      <Token size={tableLayout ? 'md' : 'lg'} tokenImageUri={token.logoURI} />
      <Stack
        flexGrow={1}
        flexBasis={0}
        {...(tableLayout && {
          flexDirection: 'row',
        })}
      >
        <XStack
          {...(tableLayout && {
            flexGrow: 1,
            flexBasis: 0,
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
          {...(tableLayout && {
            flexGrow: 1,
            flexBasis: 0,
            color: '$text',
          })}
        />
      </Stack>

      <Stack
        flexDirection="column-reverse"
        alignItems="flex-end"
        {...(tableLayout && {
          flexDirection: 'row',
          flexGrow: 1,
          flexBasis: 0,
        })}
      >
        {withPrice ? (
          <XStack
            space="$2"
            alignItems="center"
            {...(tableLayout && {
              flexGrow: 1,
              flexBasis: 0,
            })}
          >
            {tableLayout ? (
              <TokenPriceView $key={token.$key ?? ''} size="$bodyMd" />
            ) : null}
            <TokenPriceChangeView $key={token.$key ?? ''} size="$bodyMd" />
          </XStack>
        ) : null}
        <TokenValueView
          $key={token.$key ?? ''}
          size="$bodyLgMedium"
          textAlign="right"
          {...(tableLayout && {
            flexGrow: 1,
            flexBasis: 0,
            size: '$bodyMdMedium',
          })}
        />
      </Stack>
    </ListItem>
  );
}

export { TokenListItem };
