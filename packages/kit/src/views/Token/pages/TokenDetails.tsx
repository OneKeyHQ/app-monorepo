import {
  Divider,
  Heading,
  Image,
  Page,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';

import { TxHistoryListView } from '../../Home/components/TxHistoryListView';

import type { IHistoryListItemProps } from '../../Home/components/TxHistoryListView/HistoryListItem';

const headerTitle = () => (
  <XStack alignItems="center">
    <Image
      width="$6"
      height="$6"
      source={{
        uri: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png',
      }}
    />
    <Heading pl="$2" size="$headingLg">
      ETH
    </Heading>
  </XStack>
);

const data: { title: string; data: IHistoryListItemProps[] }[] = [
  {
    title: 'DEC 20, 2023',
    data: [
      {
        title: 'Send',
        description: {
          prefix: 'To',
          children: 'addr1q...ckw2',
        },
        change: '-0.01 ETH',
        avatar: {
          circular: true,
          fallbackIcon: 'ArrowTopSolid',
        },
      },
    ],
  },
  {
    title: 'DEC 19, 2023',
    data: [
      {
        title: 'Receive',
        description: {
          prefix: 'To',
          children: 'addr1q...ckw2',
        },
        change: '+0.01 ETH',
        avatar: {
          circular: true,
          fallbackIcon: 'ArrowBottomSolid',
        },
      },
    ],
  },
];

export function TokenDetails() {
  return (
    <Page scrollEnabled>
      <Page.Header headerTitle={headerTitle} />
      <Page.Body>
        <Stack px="$5">
          <SizableText>Balance</SizableText>
          <Stack
            $gtMd={{
              flexDirection: 'row',
              alignItems: 'baseline',
              space: '$2',
            }}
          >
            <Heading size="$heading5xl">2.35</Heading>
            <SizableText color="$textSubdued" size="$bodyLgMedium">
              $3,836.97
            </SizableText>
          </Stack>
        </Stack>
        <Divider my="$5" />
        <TxHistoryListView data={data} />
      </Page.Body>
    </Page>
  );
}
