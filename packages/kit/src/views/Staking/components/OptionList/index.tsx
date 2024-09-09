import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Empty,
  ListView,
  NumberSizeableText,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';
import type { IClaimableListItem } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

type IOptionItem = IClaimableListItem;

type IExtraField = {
  name: string;
  renderItem: ({ item }: { item: IClaimableListItem }) => string;
};

type IOptionListContext = {
  extraFields?: IExtraField[];
  activeId?: string;
};

const OptionListContext = createContext<IOptionListContext>({});

export type IOnSelectOption = (params: {
  item: IOptionItem;
}) => void | Promise<void>;

const ExtraField = ({
  name,
  renderItem,
  item,
}: IExtraField & { item: IClaimableListItem }) => (
  <XStack justifyContent="space-between">
    <SizableText size="$bodyMd" color="$textSubdued">
      {name}
    </SizableText>
    <SizableText size="$bodyMd" color="$textSubdued">
      {renderItem({ item })}
    </SizableText>
  </XStack>
);

const OptionItem = ({
  item,
  token,
  network,
  onPress,
}: {
  item: IOptionItem;
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
  const { extraFields, activeId } = useContext(OptionListContext);
  const active = activeId === item.id;
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
        {extraFields && extraFields.length > 0 ? (
          <YStack py={12} px={14} gap={10}>
            {extraFields.map((o) => (
              <Suspense key={o.name} fallback={null}>
                <ExtraField
                  name={o.name}
                  renderItem={o.renderItem}
                  item={item}
                />
              </Suspense>
            ))}
          </YStack>
        ) : null}
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
  extraFields?: IExtraField[];
};

export const OptionList = ({
  items,
  token,
  network,
  onPress,
  onConfirmText,
  extraFields,
}: IOptionListProps) => {
  const appNavigation = useAppNavigation();
  const [activeId, setActiveId] = useState(items[0]?.id);
  const [loading, setLoading] = useState(false);

  const renderItem = useCallback(
    ({ item }: { item: IOptionItem }) => (
      <OptionItem
        item={item}
        token={token}
        network={network}
        onPress={({ item: o }) => setActiveId(o.id)}
      />
    ),
    [token, network],
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

  const ctx = useMemo(
    () => ({ extraFields, activeId }),
    [extraFields, activeId],
  );

  return (
    <OptionListContext.Provider value={ctx}>
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
    </OptionListContext.Provider>
  );
};
