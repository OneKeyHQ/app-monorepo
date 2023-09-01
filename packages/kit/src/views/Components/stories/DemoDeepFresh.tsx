import { memo, useEffect, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isEqual, random, sample, shuffle } from 'lodash';

import {
  Box,
  Button,
  ScrollView,
  Stack,
  Typography,
} from '@onekeyhq/components';
import { DebugRenderTracker } from '@onekeyhq/components/src/DebugRenderTracker';

import {
  atom,
  createJotaiContext,
} from '../../../store/jotai/createJotaiContext';
import { wait } from '../../../utils/helper';

const OWNED_TOKENS = [
  [
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    '0x1f068a896560632a4d2e05044bd7f03834f1a465',
  ],
  [
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    '0x4d224452801aced8b2f0aebe155379bb5d594381',
  ],
  [
    '0x630fe3adb53f3d2e0c594bc180309fdfdd0a854d',
    '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0',
  ],
];

async function mockBackgroundTokensFetch({
  shouldShuffle,
}: {
  shouldShuffle: boolean;
}) {
  console.log('mockBackgroundTokensFetch ------------===========');
  let items: IDemoDeepFreshToken[] = [
    {
      networkId: 'evm--1',
      accountId: "hd-1--m/44'/60'/0'/0/0",
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      name: 'BTC',
      balance: random(1, 2).toString(),
      price: random(5.1, 7.001).toString(),
    },
    {
      networkId: 'evm--2',
      accountId: "hd-2--m/44'/60'/0'/0/0",
      address: '0x4d224452801aced8b2f0aebe155379bb5d594381',
      name: 'USDT',
      balance: random(50, 51).toString(),
      price: random(5.1, 7.001).toString(),
    },
    {
      networkId: 'evm--3',
      accountId: "hd-1--m/44'/60'/0'/0/0",
      address: '0x1f068a896560632a4d2e05044bd7f03834f1a465',
      name: 'ADA',
      balance: random(1, 100).toString(),
      price: random(5.1, 7.001).toString(),
    },
    {
      networkId: 'evm--4',
      accountId: "hd-1--m/44'/60'/0'/0/0",
      address: '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0',
      name: 'MATIC',
      balance: random(1, 100).toString(),
      price: random(5.1, 7.001).toString(),
    },
    {
      networkId: 'evm--5',
      accountId: "hd-1--m/44'/60'/0'/0/0",
      address: '0x630fe3adb53f3d2e0c594bc180309fdfdd0a854d',
      name: 'SOL',
      balance: random(1, 100).toString(),
      price: random(5.1, 7.001).toString(),
    },
  ];
  if (shouldShuffle) {
    items = shuffle(items);
  }
  const keys: string[] = [];
  const map: {
    [key: string]: IDemoDeepFreshTokenValuesMap;
  } = {};
  const ownedTokens = sample(OWNED_TOKENS);
  items.forEach((item) => {
    const key = `${item.networkId}__${item.accountId}__${item.address}__${item.name}`;
    item.$key = key;
    item.owned = ownedTokens?.includes(item.address);
    keys.push(key);
    map[key] = {
      price: item.price,
      balance: item.balance,
      owned: item.owned,
    };
  });
  await wait(1000);
  const overview: IDemoDeepFreshOverview = {
    totalCounts: random(10, 11).toString(),
    totalValues: random(399, 500).toString(),
  };
  return {
    items,
    keys,
    map,
    overview,
  };
}
interface IDemoDeepFreshOverview {
  totalCounts: string;
  totalValues: string;
}
interface IDemoDeepFreshToken {
  networkId: string;
  accountId: string;
  address: string;
  name: string;
  balance: string;
  price: string;
  $key?: string;
  owned?: boolean;
}
interface IDemoDeepFreshTokenValuesMap {
  balance: string;
  price: string;
  owned?: boolean;
}

const atomDemoDeepFreshTokens = atom<{
  items: IDemoDeepFreshToken[];
  keys: string[];
}>({
  items: [],
  keys: [],
});

const atomDemoDeepFreshTokensMap = atom<{
  [key: string]: IDemoDeepFreshTokenValuesMap;
}>({});

const atomDemoDeepFreshOverview = atom<IDemoDeepFreshOverview>({
  totalCounts: '0',
  totalValues: '0',
});

const atomDemoDeepFreshTokensLoading = atom<boolean>(false);

const atomDemoDeepFreshReload = atom(
  null,
  async (
    get,
    set,
    {
      shouldShuffle = false,
    }: {
      shouldShuffle?: boolean;
    } = {},
  ) => {
    try {
      set(atomDemoDeepFreshTokensLoading, true);
      // TODO usePromiseResult
      const result = await mockBackgroundTokensFetch({ shouldShuffle });
      if (!isEqual(get(atomDemoDeepFreshTokens).keys, result.keys)) {
        set(atomDemoDeepFreshTokens, result);
      }
      set(atomDemoDeepFreshTokensMap, result.map);
      set(atomDemoDeepFreshOverview, result.overview);
    } finally {
      set(atomDemoDeepFreshTokensLoading, false);
    }
  },
);

const {
  // Provider: ProviderDemoDeepFresh,
  withProvider: withProviderDemoDeepFresh,
  useContextAtom: useAtomDemoDeepFresh,
} = createJotaiContext();

function BalanceView({ balance }: { balance: string }) {
  return (
    <DebugRenderTracker>
      <Box pr={2}>
        <Typography.Body1Strong>{balance}</Typography.Body1Strong>
      </Box>
    </DebugRenderTracker>
  );
}
const BalanceViewMemo = memo(BalanceView);
function BalanceViewDeepFresh({ $key }: IDemoDeepFreshToken) {
  const [map] = useAtomDemoDeepFresh(atomDemoDeepFreshTokensMap);
  const item = map[$key || ''];
  return <BalanceViewMemo balance={item?.balance} />;
}

function PriceView({ price }: { price: string }) {
  return (
    <DebugRenderTracker>
      <Typography.Body1Strong>
        $ {new BigNumber(price).toFixed(2)}
      </Typography.Body1Strong>
    </DebugRenderTracker>
  );
}
const PriceViewMemo = memo(PriceView);
function PriceViewDeepFresh({ $key }: IDemoDeepFreshToken) {
  const [map] = useAtomDemoDeepFresh(atomDemoDeepFreshTokensMap);
  const item = map[$key || ''];
  return <PriceViewMemo price={item?.price} />;
}

function OwnedViewDeepFresh({ $key }: IDemoDeepFreshToken) {
  const [map] = useAtomDemoDeepFresh(atomDemoDeepFreshTokensMap);
  const item = map[$key || ''];
  const content = useMemo(
    () => (
      <DebugRenderTracker>
        <Typography.Body1Strong>
          {item.owned ? '   ✅' : '   '}
        </Typography.Body1Strong>
      </DebugRenderTracker>
    ),
    [item.owned],
  );
  return content;
}

function DemoDeepFreshTokenCell({ item }: { item: IDemoDeepFreshToken }) {
  return (
    <DebugRenderTracker>
      <Box borderTopColor="divider" borderTopWidth={1} py={4}>
        <Typography.Body1>{item.address}</Typography.Body1>
        <Stack direction="row">
          <BalanceViewDeepFresh {...item} />
          <Typography.Body1Strong>{item?.name}</Typography.Body1Strong>
          <Box flex={1} />
          <PriceViewDeepFresh {...item} />
        </Stack>
        <Typography.Body1>{item.networkId}</Typography.Body1>
        <Stack direction="row">
          <Typography.Body1>{item.accountId}</Typography.Body1>
          <OwnedViewDeepFresh {...item} />
        </Stack>
      </Box>
    </DebugRenderTracker>
  );
}
function DemoDeepFreshTokenList() {
  const [tokensInfo] = useAtomDemoDeepFresh(atomDemoDeepFreshTokens);

  return (
    <DebugRenderTracker>
      <Box mt={4}>
        {tokensInfo.items.map((item) => (
          <DemoDeepFreshTokenCell key={item.$key} item={item} />
        ))}
      </Box>
    </DebugRenderTracker>
  );
}

function DemoDeepFreshOverviewTotalCounts() {
  const [val] = useAtomDemoDeepFresh(atomDemoDeepFreshOverview);
  const content = useMemo(
    () => (
      <DebugRenderTracker>
        <Typography.Body1Strong>{val.totalCounts}</Typography.Body1Strong>
      </DebugRenderTracker>
    ),
    [val.totalCounts],
  );
  return content;
}

function DemoDeepFreshOverviewTotalValues() {
  const [val] = useAtomDemoDeepFresh(atomDemoDeepFreshOverview);
  const content = useMemo(
    () => (
      <DebugRenderTracker>
        <Typography.Body1Strong>{val.totalValues}</Typography.Body1Strong>
      </DebugRenderTracker>
    ),
    [val.totalValues],
  );
  return content;
}

function DemoDeepFreshOverview() {
  return (
    <DebugRenderTracker>
      <Stack direction="row" py={2}>
        <Typography.Body1Strong>Total: </Typography.Body1Strong>
        <DemoDeepFreshOverviewTotalCounts />
        <Box mr={4} />
        <Typography.Body1Strong> Values: $</Typography.Body1Strong>
        <DemoDeepFreshOverviewTotalValues />
      </Stack>
    </DebugRenderTracker>
  );
}

function ReloadButtons() {
  const [, refresh] = useAtomDemoDeepFresh(atomDemoDeepFreshReload);
  const [loading] = useAtomDemoDeepFresh(atomDemoDeepFreshTokensLoading);

  return (
    <DebugRenderTracker>
      <Box>
        <Button size="lg" onPress={() => refresh()} isLoading={loading}>
          Refresh
        </Button>
        <Button
          size="lg"
          mt={4}
          onPress={() => refresh({ shouldShuffle: true })}
          isLoading={loading}
        >
          Shuffle
        </Button>
      </Box>
    </DebugRenderTracker>
  );
}

function ReloadOnMount() {
  const [, refresh] = useAtomDemoDeepFresh(atomDemoDeepFreshReload);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return null;
}

function DemoDeepFresh() {
  // const [loading] = useAtomDemoDeepFresh(atomDemoDeepFreshTokensLoading);

  return (
    <Box flex="1">
      <ScrollView p={8}>
        <DebugRenderTracker>
          <Box>
            <ReloadButtons />
            <ReloadOnMount />
            <DemoDeepFreshOverview />
            <DemoDeepFreshTokenList />
          </Box>
        </DebugRenderTracker>
      </ScrollView>
    </Box>
  );
}

export default withProviderDemoDeepFresh(DemoDeepFresh);
