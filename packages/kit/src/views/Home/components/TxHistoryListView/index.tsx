/* eslint-disable react/prop-types */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Avatar,
  Divider,
  Empty,
  Icon,
  Image,
  ListItem,
  SectionList,
  SizableText,
  Stack,
  XStack,
  ZStack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IAccountHistoryTx,
  IHistoryListSectionGroup,
} from '@onekeyhq/shared/types/history';

import { HistoryListItem } from './HistoryListItem';
import { TxHistoryListHeader } from './TxHistoryListHeader';
import { TxHistoryListItem } from './TxHistoryListItem';
import { TxHistorySectionHeader } from './TxHistorySectionHeader';

import type { IHistoryListItemProps } from './HistoryListItem';

type IProps = {
  data: IHistoryListSectionGroup[];
  accountAddress: string;
  isLoading?: boolean;
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
  tableLayout?: boolean;
};

function TxHistoryListEmpty() {
  const intl = useIntl();

  return (
    <Stack height="100%" alignItems="center" justifyContent="center">
      <Empty
        title={intl.formatMessage({ id: 'transaction__history_empty_title' })}
        description={intl.formatMessage({
          id: 'transaction__history_empty_desc',
        })}
      />
    </Stack>
  );
}

const fakeData: { title: string; data: IHistoryListItemProps[] }[] = [
  {
    title: 'DEC 20, 2023 (Send)',
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
          src: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png',
          fallbackIcon: 'QuestionmarkSolid',
        },
      },
      {
        title: 'Send',
        description: {
          prefix: 'To',
          children: 'addr1q...ckw2',
        },
        change: '-3 NFTs',
        changeDescription: '#13798504 and more',
        avatar: {
          src: 'https://images.glow.app/https%3A%2F%2Farweave.net%2F0WFtaZrc_DUzL2Tt_zztq-9cfJoSDhDacSfrPT50HOo%3Fext%3Dpng?ixlib=js-3.8.0&w=80&h=80&dpr=2&fit=crop&s=7af3b8e6a74c4abc0ab9de93ca67d1c4',
          fallbackIcon: 'ImageMountainSolid',
        },
      },
    ],
  },
  {
    title: 'DEC 20, 2023 (Receive)',
    data: [
      {
        title: 'Receive',
        description: {
          prefix: 'From',
          children: 'addr1q...ckw2',
        },
        change: '+0.01 ETH',
        avatar: {
          circular: true,
          src: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png',
          fallbackIcon: 'QuestionmarkSolid',
        },
      },
      {
        title: 'Receive',
        description: {
          prefix: 'From',
          children: 'addr1q...ckw2',
        },
        change: '+#13798504',
        avatar: {
          src: 'https://images.glow.app/https%3A%2F%2Farweave.net%2FhRZG2ePVGpBSogaNSdp4Jm3vUILhvB-h3gB7-nRrPsE%3Fext%3Dpng?ixlib=js-3.8.0&w=80&h=80&dpr=2&fit=crop&s=cbd0b1bc0ab5d8b867930546c5e87358',
          fallbackIcon: 'ImageMountainSolid',
        },
      },
      {
        title: 'Receive',
        description: {
          prefix: 'From',
          children: 'addr1q...ckw2',
        },
        change: '+0.01 TOKEN',
        avatar: {
          circular: true,
          src: '',
          fallbackIcon: 'QuestionmarkSolid',
        },
      },
      {
        title: 'Receive',
        description: {
          prefix: 'From',
          children: 'addr1q...ckw2',
        },
        change: '+Unknown NFT',
        avatar: {
          src: '',
          fallbackIcon: 'ImageMountainSolid',
        },
      },
    ],
  },
  {
    title: 'DEC 20, 2023 (Swap)',
    data: [
      {
        title: 'Swap',
        description: {
          children: 'ETH → Matic',
        },
        change: '+1000 Matic',
        changeDescription: '-0.01 ETH',
        avatar: {
          circular: true,
          src: [
            'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png',
            'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/matic.png',
          ],
          fallbackIcon: 'ImageMountainSolid',
        },
      },
    ],
  },
  {
    title: 'DEC 20, 2023 (Unkonwn Contrast)',
    data: [
      {
        title: 'Contract Called',
        description: {
          prefix: 'To',
          icon: 'Document2Solid',
          children: '0xdBc6...5d21',
        },
        change: '-0.01 ETH',
        avatar: {
          circular: true,
          src: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png',
          fallbackIcon: 'Document2Solid',
        },
      },
    ],
  },
  {
    title: 'DEC 20, 2023 (Buy, sell, mint)',
    data: [
      {
        title: 'Buy',
        description: {
          prefix: 'From',
          children: 'addr1q...ckw2',
        },
        change: '+#2869 BG Dice',
        changeDescription: '-0.18 ETH',
        avatar: {
          src: 'https://images.glow.app/https%3A%2F%2Farweave.net%2F0WFtaZrc_DUzL2Tt_zztq-9cfJoSDhDacSfrPT50HOo%3Fext%3Dpng?ixlib=js-3.8.0&w=80&h=80&dpr=2&fit=crop&s=7af3b8e6a74c4abc0ab9de93ca67d1c4',
          fallbackIcon: 'ImageMountainSolid',
        },
      },
      {
        title: 'Sell',
        description: {
          prefix: 'To',
          children: 'addr1q...ckw2',
        },
        change: '+0.20 ETH',
        changeDescription: '-#42 NAMI',
        avatar: {
          src: 'https://images.glow.app/https%3A%2F%2Farweave.net%2FhRZG2ePVGpBSogaNSdp4Jm3vUILhvB-h3gB7-nRrPsE%3Fext%3Dpng?ixlib=js-3.8.0&w=80&h=80&dpr=2&fit=crop&s=cbd0b1bc0ab5d8b867930546c5e87358',
          fallbackIcon: 'QuestionmarkSolid',
        },
      },
      {
        title: 'Mint',
        description: {
          prefix: 'From',
          icon: 'Document2Solid',
          children: '0x0e70...827a',
        },
        change: '+VIP Oath',
        changeDescription: '-0.01 ETH',
        avatar: {
          src: 'https://images.glow.app/https%3A%2F%2Farweave.net%2F99eb109nC2JgMA5GHpW0GK8TdidO8lm5eDj0FgzfWdA%3Fext%3Dpng?ixlib=js-3.8.0&w=80&h=80&dpr=2&fit=crop&s=2ff9b1faad864bf338d0b881051f6c16',
          fallbackIcon: 'ImageMountainSolid',
        },
      },
    ],
  },
  {
    title: 'DEC 20, 2023 (Stake)',
    data: [
      {
        title: 'Stake',
        description: {
          prefix: 'To',
          icon: 'Document2Solid',
          children: '0xae7a...fE84',
        },
        change: '+2.5 stETH',
        changeDescription: '-0.25 ETH',
        avatar: {
          circular: true,
          src: 'https://assets.coingecko.com/coins/images/13442/standard/steth_logo.png?1696513206',
          fallbackIcon: 'QuestionmarkSolid',
        },
      },
      {
        title: 'Unstake',
        description: {
          prefix: 'From',
          icon: 'Document2Solid',
          children: '0xae7a...fE84',
        },
        change: '+2.5 ETH',
        changeDescription: '-2.5 stETH',
        avatar: {
          circular: true,
          src: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png',
          fallbackIcon: 'QuestionmarkSolid',
        },
      },
    ],
  },
  {
    title: 'DEC 20, 2023 (Approve)',
    data: [
      {
        title: 'Approve 3.3084 WETH',
        description: {
          prefix: 'To',
          icon: 'Document2Solid',
          children: '0xdBc6...5d21',
        },
        avatar: {
          circular: true,
          src: 'https://miro.medium.com/v2/resize:fit:512/1*QOaEMfl4SEx8LlVKTk4oaQ.png',
          fallbackIcon: 'QuestionmarkSolid',
        },
      },
      {
        title: 'Approve',
        description: {
          prefix: 'To',
          icon: 'Document2Solid',
          children: '0xa36d...8e28',
        },
        avatar: {
          src: 'https://images.glow.app/https%3A%2F%2Farweave.net%2F99eb109nC2JgMA5GHpW0GK8TdidO8lm5eDj0FgzfWdA%3Fext%3Dpng?ixlib=js-3.8.0&w=80&h=80&dpr=2&fit=crop&s=2ff9b1faad864bf338d0b881051f6c16',
          fallbackIcon: 'ImageMountainSolid',
        },
      },
      {
        title: 'Revoke DAI',
        description: {
          prefix: 'To',
          icon: 'Document2Solid',
          children: '1inch',
        },
        avatar: {
          src: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/dai.png',
          fallbackIcon: 'ImageMountainSolid',
        },
      },
    ],
  },
];

const ItemSeparatorComponent = ({ leadingItem }) => {
  const { section, index } = leadingItem;

  if (!section || index === section.data.length - 1) {
    return null;
  }

  return <Divider mx="$5" />;
};

const ListFooterComponent = () => <Stack h="$5" />;

function TxHistoryListView(props: IProps) {
  const { data, accountAddress, tableLayout, onContentSizeChange } = props;

  return (
    <SectionList
      h="100%"
      scrollEnabled={platformEnv.isWebTouchable}
      onContentSizeChange={onContentSizeChange}
      sections={fakeData}
      // renderSectionHeader={({ section }) => (
      //   <TxHistorySectionHeader {...section} />
      // )}
      renderSectionHeader={({ section: { title } }) => (
        <SectionList.SectionHeader title={title} />
      )}
      ListHeaderComponent={TxHistoryListHeader}
      ListEmptyComponent={TxHistoryListEmpty}
      estimatedItemSize={60}
      // renderItem={({ item }: { item: IAccountHistoryTx }) => (
      //   <TxHistoryListItem
      //     key={item.id}
      //     historyTx={item}
      //     accountAddress={accountAddress}
      //   />
      // )}
      renderItem={({ item }: { item: IHistoryListItemProps }) => (
        <HistoryListItem
          title={item.title}
          description={item.description}
          avatar={item.avatar}
          change={item.change}
          changeDescription={item.changeDescription}
          tableLayout={tableLayout}
          onPress={() => console.log('clicked')}
        />
      )}
      ListFooterComponent={ListFooterComponent}
      {...(tableLayout && {
        ItemSeparatorComponent,
      })}
    />
  );
}

export { TxHistoryListView };
