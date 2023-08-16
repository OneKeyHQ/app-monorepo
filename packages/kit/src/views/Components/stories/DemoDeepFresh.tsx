import { memo, useCallback, useEffect, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { isEqual, random, shuffle } from 'lodash';
import { boolean } from 'superstruct';

import {
  Box,
  Button,
  Center,
  ScrollView,
  Typography,
  useThemeValue,
} from '@onekeyhq/components';
import { DebugRenderTracker } from '@onekeyhq/components/src/DebugRenderTracker';

import {
  atom,
  createJotaiContext,
} from '../../../store/jotai/createJotaiContext';
import { wait } from '../../../utils/helper';

async function mockBackgroundTokensFetch({
  shouldShuffle,
}: {
  shouldShuffle: boolean;
}) {
  console.log('mockBackgroundTokensFetch ------------===========');
  let items: DemoDeepFreshToken[] = [
    {
      networkId: 'evm--1',
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      name: 'BTC',
      balance: random(1, 2).toString(),
      price: random(5.1, 7.001).toString(),
    },
    {
      networkId: 'evm--2',
      address: '0x4d224452801aced8b2f0aebe155379bb5d594381',
      name: 'USDT',
      balance: random(50, 51).toString(),
      price: random(5.1, 7.001).toString(),
    },
    {
      networkId: 'evm--3',
      address: '0x1f068a896560632a4d2e05044bd7f03834f1a465',
      name: 'ADA',
      balance: random(1, 100).toString(),
      price: random(5.1, 7.001).toString(),
    },
    {
      networkId: 'evm--4',
      address: '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0',
      name: 'MATIC',
      balance: random(1, 100).toString(),
      price: random(5.1, 7.001).toString(),
    },
    {
      networkId: 'evm--5',
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
    [key: string]: DemoDeepFreshToken;
  } = {};
  items.forEach((item) => {
    const key = `${item.address}__${item.networkId}`;
    item.$key = key;
    keys.push(key);
    map[key] = item;
  });
  await wait(1500);
  return {
    items,
    keys,
    map,
  };
}

interface DemoDeepFreshToken {
  networkId: string;
  address: string;
  name: string;
  balance: string;
  price: string;
  $key?: string;
}

const atomDemoDeepFreshTokens = atom<{
  items: DemoDeepFreshToken[];
  keys: string[];
}>({
  items: [],
  keys: [],
});

const atomDemoDeepFreshTokensMap = atom<{
  [key: string]: DemoDeepFreshToken;
}>({});

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
      const result = await mockBackgroundTokensFetch({ shouldShuffle });
      if (!isEqual(get(atomDemoDeepFreshTokens).keys, result.keys)) {
        set(atomDemoDeepFreshTokens, result);
      }
      set(atomDemoDeepFreshTokensMap, result.map);
    } finally {
      set(atomDemoDeepFreshTokensLoading, false);
    }
  },
);

const {
  Provider: ProviderDemoDeepFresh,
  withProvider: withProviderDemoDeepFresh,
  useContextAtom: useAtomDemoDeepFresh,
} = createJotaiContext();

function BalanceView({ name, balance }: { name: string; balance: string }) {
  return (
    <DebugRenderTracker>
      <Typography.Body1Strong>
        {balance} {name}
      </Typography.Body1Strong>
    </DebugRenderTracker>
  );
}
const BalanceViewMemo = memo(BalanceView);
function BalanceViewDeepFresh({ $key }: DemoDeepFreshToken) {
  const [map] = useAtomDemoDeepFresh(atomDemoDeepFreshTokensMap);
  const item = map[$key || ''];
  return <BalanceViewMemo balance={item?.balance} name={item?.name} />;
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
function PriceViewDeepFresh({ $key }: DemoDeepFreshToken) {
  const [map] = useAtomDemoDeepFresh(atomDemoDeepFreshTokensMap);
  const item = map[$key || ''];
  return <PriceViewMemo price={item?.price} />;
}

function DemoDeepFreshTokenCell({ item }: { item: DemoDeepFreshToken }) {
  return (
    <DebugRenderTracker>
      <Box borderTopColor="divider" borderTopWidth={1} p={4}>
        <Typography.Body1>{item.address}</Typography.Body1>
        <BalanceViewDeepFresh {...item} />
        <Typography.Body1>{item.networkId}</Typography.Body1>
        <PriceViewDeepFresh {...item} />
      </Box>
    </DebugRenderTracker>
  );
}
function DemoDeepFreshTokenList() {
  const [tokensInfo] = useAtomDemoDeepFresh(atomDemoDeepFreshTokens);

  return (
    <DebugRenderTracker>
      <Box mt={8}>
        {tokensInfo.items.map((item) => (
          <DemoDeepFreshTokenCell key={item.$key} item={item} />
        ))}
      </Box>
    </DebugRenderTracker>
  );
}

function ReloadButtons() {
  const [, refresh] = useAtomDemoDeepFresh(atomDemoDeepFreshReload);
  const [loading] = useAtomDemoDeepFresh(atomDemoDeepFreshTokensLoading);

  return (
    <DebugRenderTracker>
      <Box>
        <Button onPress={() => refresh()} isLoading={loading}>
          Refresh
        </Button>
        <Button
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
            <DemoDeepFreshTokenList />
          </Box>
        </DebugRenderTracker>
      </ScrollView>
    </Box>
  );
}

export default withProviderDemoDeepFresh(DemoDeepFresh);
