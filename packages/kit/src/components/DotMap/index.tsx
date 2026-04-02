import { useMemo } from 'react';

import { chunk, range } from 'lodash';
import { StyleSheet } from 'react-native';

import {
  Divider,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { mnemonicToDotMapValues } from './utils';

import type { IDotMapValues } from './types';

type IDotProps = {
  disabled?: boolean;
  value?: boolean;
};
const Dot = ({ disabled, value }: IDotProps) => {
  if (disabled) {
    return <Stack width="$4" height="$4" backgroundColor="$bgDisabled" />;
  }
  return (
    <Stack width="$4" height="$4" justifyContent="center" alignItems="center">
      {value ? (
        <Stack
          width="$1.5"
          height="$1.5"
          borderRadius="$full"
          backgroundColor="#299764"
        />
      ) : null}
    </Stack>
  );
};

type IDot4GroupProps = {
  values?: boolean[];
  disabled?: boolean;
};
const Dot4Group = ({ values, disabled }: IDot4GroupProps) => {
  const items = useMemo(() => {
    if (!values || values.length < 4) {
      return [false, false, false, false];
    }
    return values.slice(0, 4);
  }, [values]);
  return (
    <XStack
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$border"
      separator={<Divider vertical backgroundColor="$border" />}
    >
      {items.map((o, index) => (
        <Dot key={index} value={o} disabled={disabled} />
      ))}
    </XStack>
  );
};

type IDotWordProps = {
  values: boolean[];
};

const DotWord = ({ values }: IDotWordProps) => {
  const chucked = chunk(values, 4);
  return (
    <XStack separator={<Stack width="$2" height="$2" />}>
      <Dot4Group values={chucked?.[0]} disabled={chucked.length === 0} />
      <Dot4Group values={chucked?.[1]} disabled={chucked.length === 0} />
      <Dot4Group values={chucked?.[2]} disabled={chucked.length === 0} />
    </XStack>
  );
};

type IDotMapRowProps = { data: IDotMapValues };
const DotMapRow = ({ data }: IDotMapRowProps) => (
  <XStack alignItems="center">
    <XStack width="$6" justifyContent="flex-end">
      <SizableText size="$bodySm" mr="$2" color="$textSubdued">
        {data.index}
      </SizableText>
    </XStack>
    <DotWord values={data.values} />
  </XStack>
);

const DotMapRowGroup = ({ items }: { items: IDotMapValues[] }) =>
  items.map((data, index) => <DotMapRow key={index} data={data} />);

type IDotMapProps = {
  mnemonic: string;
};

const DotMapBaseHeader = () => {
  const items = useMemo<number[]>(() => range(1, 13), []);
  return (
    <XStack alignItems="flex-end" pb="$2">
      <XStack width="$6" justifyContent="flex-end">
        <Icon name="OnekeyBrand" />
      </XStack>
      <XStack
        h="$10"
        alignItems="flex-end"
        separator={<Divider vertical backgroundColor="$transparent" />}
      >
        {items.map((o) => (
          <XStack
            key={o}
            width="$4"
            height="$10"
            mr={o % 4 === 0 ? '$2' : undefined}
          >
            <Stack style={{ transform: [{ rotate: '-90deg' }] }}>
              <SizableText size="$bodySm" color="$textSubdued" w="$10">
                {2 ** (12 - o)}
              </SizableText>
            </Stack>
          </XStack>
        ))}
      </XStack>
    </XStack>
  );
};

export const DotMapBase = ({ items }: { items: IDotMapValues[] }) => {
  const chucked = chunk(items, 4);
  return (
    <Stack
      backgroundColor="$bgSubdued"
      p="$4"
      borderRadius={14}
      borderWidth="$1.5"
      borderColor="$borderSubdued"
    >
      <YStack>
        <DotMapBaseHeader />
        <YStack separator={<Stack width="$2" height="$2" />}>
          {chucked.map((o, index) => (
            <DotMapRowGroup items={o} key={index} />
          ))}
        </YStack>
      </YStack>
    </Stack>
  );
};

export const DotMap = ({ mnemonic }: IDotMapProps) => {
  const {
    first12: front,
    last12: back,
    resp: all,
  } = useMemo(() => {
    const resp = mnemonicToDotMapValues(mnemonic);
    const first12 = resp.slice(0, 12);
    let last12 = resp.slice(12);
    if (last12.length > 0) {
      last12 = Array.from(
        { length: 12 },
        (v, i) => last12[i] || { index: i + 13, values: [] },
      );
    }
    return { first12, last12, resp };
  }, [mnemonic]);

  return (
    <YStack separator={<Stack h="$4" />} alignItems="flex-start">
      <Stack>
        <DotMapBase items={front} />
        <XStack justifyContent="center" mt="$1">
          <SizableText size="$bodyMd" color="$textSubdued">
            Front (#1 - 12)
          </SizableText>
        </XStack>
      </Stack>
      {back.length > 0 ? (
        <Stack>
          <DotMapBase items={back} />
          <XStack justifyContent="center" mt="$1">
            <SizableText size="$bodyMd" color="$textSubdued">
              Back (#13 - #{all.length})
            </SizableText>
          </XStack>
        </Stack>
      ) : null}
    </YStack>
  );
};
