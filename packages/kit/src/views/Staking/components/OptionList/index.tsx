import type { ComponentProps } from 'react';
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
  Badge,
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
  const intl = useIntl();
  const isDisabled = item.extra?.disabled;
  return (
    <Stack px="$5" py="$2">
      <YStack
        group
        onPress={isDisabled ? undefined : () => onPress?.({ item })}
        borderWidth={StyleSheet.hairlineWidth}
        borderColor={active && !isDisabled ? '$borderActive' : '$borderSubdued'}
        borderRadius="$3"
        borderCurve="continuous"
        overflow="hidden"
        userSelect="none"
        opacity={isDisabled ? 0.5 : 1}
        cursor={isDisabled ? 'not-allowed' : 'pointer'}
      >
        <XStack
          bg="$bgSubdued"
          {...(isDisabled
            ? {}
            : {
                '$group-hover': {
                  bg: '$bgHover',
                },
                '$group-press': {
                  bg: '$bgActive',
                },
              })}
          px={14}
          py={12}
          jc="space-between"
          ai="center"
        >
          <XStack>
            <Stack pr="$3">
              <Token
                tokenImageUri={token.logoURI}
                networkImageUri={network?.logoURI}
              />
            </Stack>
            <YStack>
              <NumberSizeableText
                size="$bodyLgMedium"
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
          {item.isPending ? (
            <Stack>
              <Badge badgeType="info">
                {intl.formatMessage({ id: ETranslations.global_pending })}
              </Badge>
            </Stack>
          ) : null}
          {item.extra?.badge ? (
            <Stack>
              <Badge badgeType={item.extra.badge.badgeType}>
                <Badge.Text>{item.extra.badge.tag}</Badge.Text>
              </Badge>
            </Stack>
          ) : null}
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
        id: ETranslations.earn_no_orders,
      })}
      description={intl.formatMessage({
        id: ETranslations.earn_no_orders_desc,
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
  ListHeaderComponent?: ComponentProps<typeof ListView>['ListHeaderComponent'];
  description?: {
    text: string;
  };
};

export const OptionList = ({
  items,
  token,
  network,
  onPress,
  onConfirmText,
  extraFields,
  ListHeaderComponent,
  description,
}: IOptionListProps) => {
  const appNavigation = useAppNavigation();
  // Find the first non-disabled item as the default active item
  const firstEnabledItem = useMemo(
    () => items.find((item) => !item.extra?.disabled),
    [items],
  );
  const [activeId, setActiveId] = useState(firstEnabledItem?.id);
  const [loading, setLoading] = useState(false);

  // Check if there are any disabled items to determine if we should show the description
  const hasDisabledItems = useMemo(
    () => items.some((item) => item.extra?.disabled),
    [items],
  );

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

  const isDisabled = useMemo(() => {
    if (!activeId) return true;
    const find = items.find(
      (item) =>
        item.id === activeId && !item.isPending && !item.extra?.disabled,
    );
    return !find;
  }, [activeId, items]);

  const ListFooterComponent = useMemo(() => {
    if (hasDisabledItems && description?.text) {
      return (
        <Stack px="$5" py="$4">
          <SizableText size="$bodySm" color="$textSubdued" textAlign="center">
            {description.text}
          </SizableText>
        </Stack>
      );
    }
    return null;
  }, [hasDisabledItems, description?.text]);

  return (
    <OptionListContext.Provider value={ctx}>
      <Stack>
        <ListView
          useFlashList
          estimatedItemSize="$5"
          data={items}
          renderItem={renderItem}
          ListHeaderComponent={ListHeaderComponent}
          ListEmptyComponent={ListEmptyComponent}
          ListFooterComponent={ListFooterComponent}
        />
        <Page.Footer
          onConfirmText={onConfirmText}
          confirmButtonProps={{
            onPress: onSubmit,
            disabled: isDisabled,
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
