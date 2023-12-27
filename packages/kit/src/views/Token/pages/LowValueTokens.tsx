import { useCallback } from 'react';

import {
  Empty,
  ListItem,
  ListView,
  Page,
  Popover,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { ETokenPages } from '../router/type';

const headerRight = () => (
  <Popover
    title="Define"
    renderTrigger={<HeaderIconButton icon="QuestionmarkOutline" />}
    renderContent={
      <Stack p="$5">
        <SizableText>
          Assets valued below 0.1% of your total holdings and less than $1,000
          fall into this category.
        </SizableText>
      </Stack>
    }
  />
);

export const TOKENDATA = [
  {
    src: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/btc.png',
    title: 'BTC',
    amount: '30.00',
    price: '$10000',
    value: '$902,617.17',
    change: '+4.32%',
  },
  {
    src: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png',
    title: 'ETH',
    amount: '2.35',
    price: '$10000',
    value: '$3,836.97',
    change: '+4.32%',
  },
  {
    src: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/matic.png',
    title: 'MATIC',
    amount: '2.35',
    price: '$10000',
    value: '$10421.23',
    change: '-4.32%',
  },
];

export function LowValueTokens() {
  const navigation = useAppNavigation();

  const handleListItemPress = useCallback(() => {
    navigation.push(ETokenPages.TokenDetails);
  }, [navigation]);

  return (
    <Page>
      <Page.Header title="Low-value Assets" headerRight={headerRight} />
      <Page.Body>
        <ListView
          estimatedItemSize={60}
          data={TOKENDATA}
          renderItem={({ item }) => (
            <ListItem
              userSelect="none"
              key={item.title}
              avatarProps={{
                src: item.src,
              }}
              onPress={handleListItemPress}
            >
              <ListItem.Text
                flex={1}
                primary={item.title}
                secondary={
                  <XStack space="$2">
                    <SizableText size="$bodyMd" color="$textSubdued">
                      {item.price}
                    </SizableText>
                    <SizableText
                      size="$bodyMd"
                      color={
                        parseFloat(item.change) >= 0
                          ? '$textSuccess'
                          : '$textCritical'
                      }
                    >
                      {item.change}
                    </SizableText>
                  </XStack>
                }
              />
              <ListItem.Text
                align="right"
                primary={item.amount}
                secondary={item.value}
              />
            </ListItem>
          )}
          ListEmptyComponent={
            <Empty
              flex={1}
              icon="ControllerRoundOutline"
              title="No Low-Value Assets Found"
              description="You have no assets that fall below the 0.1% total holding threshold and under $1,000 in value."
            />
          }
          contentContainerStyle={{
            flex: 1,
          }}
        />
      </Page.Body>
    </Page>
  );
}
