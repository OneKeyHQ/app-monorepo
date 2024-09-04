import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Empty,
  ListView,
  NumberSizeableText,
  Page,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';
import type { IToken } from '@onekeyhq/shared/types/token';

type IOptionItem = { id: string; amount: string; fiatValue?: string };

export type IOnSelectOption = (params: {
  item: IOptionItem;
}) => void | Promise<void>;

const OptionItem = ({
  item,
  token,
  network,
  active,
  onPress,
}: {
  item: IOptionItem;
  token: IToken;
  network?: {
    networkId: string;
    name: string;
    logoURI: string;
  };
  active?: boolean;
  onPress?: IOnSelectOption;
}) => {
  const [
    {
      currencyInfo: { symbol },
    },
  ] = useSettingsPersistAtom();
  return (
    <Stack px="$5" py="$2">
      <YStack
        onPress={() => onPress?.({ item })}
        borderWidth={StyleSheet.hairlineWidth}
        borderColor={active ? '$borderActive' : '$borderSubdued'}
        borderRadius="$3"
        overflow="hidden"
        {...listItemPressStyle}
      >
        <XStack bg="$bgSubdued" px={14} py={12}>
          <Stack pr="$3">
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
        </XStack>
      </YStack>
    </Stack>
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
  items: IOptionItem[];
  token: IToken;
  onPress?: IOnSelectOption;
  onConfirmText?: string;
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
  onConfirmText,
}: IOptionListProps) => {
  const appNavigation = useAppNavigation();
  const [activeId, setActiveId] = useState(items[0]?.id);
  const [loading, setLoading] = useState(false);

  const renderItem = useCallback(
    ({ item }: { item: IOptionItem }) => (
      <OptionItem
        active={item.id === activeId}
        item={item}
        token={token}
        network={network}
        onPress={({ item: o }) => setActiveId(o.id)}
      />
    ),
    [token, network, activeId],
  );
  const onSubmit = useCallback(async () => {
    const activeItem = items.find((o) => o.id === activeId);
    if (activeItem) {
      try {
        setLoading(true);
        await onPress?.({ item: activeItem });
      } finally {
        setLoading(false);
      }
    }
  }, [items, activeId, onPress]);

  return (
    <Stack>
      <ListView
        estimatedItemSize="$5"
        data={items}
        renderItem={renderItem}
        ListEmptyComponent={ListEmptyComponent}
      />
      <Page.Footer
        onConfirmText={onConfirmText}
        confirmButtonProps={{
          onPress: onSubmit,
          disabled: !activeId,
          loading,
        }}
        cancelButtonProps={{
          onPress: () => {
            appNavigation.pop();
          },
        }}
      />
    </Stack>
  );
};
