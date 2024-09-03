import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Empty,
  ListView,
  NumberSizeableText,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IToken } from '@onekeyhq/shared/types/token';

type IUniversalOptionItem = { id: string; amount: string; fiatValue?: string };

export type IOnSelectOption = (params: { item: IUniversalOptionItem }) => void;

const OptionItem = ({
  item,
  token,
  network,
  onPress,
}: {
  item: IUniversalOptionItem;
  token: IToken;
  network?: {
    networkId: string;
    name: string;
    logoURI: string;
  };
  onPress?: IOnSelectOption;
}) => {
  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();
  return (
    <ListItem onPress={() => onPress?.({ item })}>
      <Stack>
        <Token
          tokenImageUri={token.logoURI}
          networkImageUri={network?.logoURI}
        />
      </Stack>
      <YStack>
        <NumberSizeableText
          formatter="balance"
          formatterOptions={{
            tokenSymbol: token?.symbol,
          }}
        >
          {item.amount}
        </NumberSizeableText>
        <NumberSizeableText
          size="$bodyMd"
          color="$textSubdued"
          formatter="value"
          formatterOptions={{ currency: symbol }}
        >
          {item.fiatValue}
        </NumberSizeableText>
      </YStack>
    </ListItem>
  );
};

const ListEmptyComponent = () => {
  const intl = useIntl();
  return (
    <Empty
      icon="ClockTimeHistoryOutline"
      title={intl.formatMessage({
        id: ETranslations.global_no_transactions_yet,
      })}
      description={intl.formatMessage({
        id: ETranslations.global_no_transactions_yet_desc,
      })}
    />
  );
};

type IOptionListProps = {
  items: IUniversalOptionItem[];
  token: IToken;
  onPress?: IOnSelectOption;
  network?: {
    networkId: string;
    name: string;
    logoURI: string;
  };
};

export const OptionList = ({
  items,
  token,
  network,
  onPress,
}: IOptionListProps) => {
  const renderItem = useCallback(
    ({ item }: { item: IUniversalOptionItem }) => (
      <OptionItem
        item={item}
        token={token}
        network={network}
        onPress={onPress}
      />
    ),
    [token, network, onPress],
  );
  return (
    <ListView
      estimatedItemSize="$5"
      data={items}
      renderItem={renderItem}
      ListEmptyComponent={ListEmptyComponent}
    />
  );
};
