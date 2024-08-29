import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Empty, ListView } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IToken } from '@onekeyhq/shared/types/token';

type IUniversalOptionItem = { id: string; amount: string };

export type IOnSelectOption = (params: { item: IUniversalOptionItem }) => void;

const UniversalOptionItem = ({
  item,
  token,
  onPress,
}: {
  item: IUniversalOptionItem;
  token: IToken;
  onPress?: IOnSelectOption;
}) => {
  const intl = useIntl();
  return (
    <ListItem
      avatarProps={{ src: token.logoURI, size: 32 }}
      title={`${item.amount} ${token.symbol}`}
    >
      <Button
        variant="primary"
        size="small"
        onPress={() => onPress?.({ item })}
      >
        {intl.formatMessage({ id: ETranslations.earn_claim })}
      </Button>
    </ListItem>
  );
};

const ListEmptyComponent = () => <Empty title="No items" />;

type IUniversalOptionListProps = {
  items: IUniversalOptionItem[];
  token: IToken;
  onPress?: IOnSelectOption;
};

export const UniversalOptionList = ({
  items,
  token,
  onPress,
}: IUniversalOptionListProps) => {
  const renderItem = useCallback(
    ({ item }: { item: IUniversalOptionItem }) => (
      <UniversalOptionItem item={item} token={token} onPress={onPress} />
    ),
    [token, onPress],
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
