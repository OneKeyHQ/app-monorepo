import { useEffect, useRef, useState } from 'react';

import {
  Button,
  Icon,
  IconButton,
  SelectableRow,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';

import { Layout } from './utils/Layout';

const ETH_ICON = 'https://uni.onekey-asset.com/static/chain/eth.png';
const USDT_ICON =
  'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xdac17f958d2ee523a2206206994597c13d831ec7-1722246302921.png';

function SelectionMark({ selected }: { selected: boolean }) {
  return (
    <Stack width="$5" height="$5" alignItems="center" justifyContent="center">
      {selected ? (
        <Icon name="CheckLargeOutline" size="$5" color="$iconSuccess" />
      ) : null}
    </Stack>
  );
}

function RowExamples() {
  const [selected, setSelected] = useState('eth');
  const [actionCount, setActionCount] = useState(0);
  return (
    <YStack width="100%" maxWidth={640} gap="$2">
      {[
        {
          id: 'eth',
          name: 'ETH',
          description: 'Ethereum',
          value: '4.25%',
          icon: ETH_ICON,
        },
        {
          id: 'usdt',
          name: 'USDT',
          description: 'Tether USD',
          value: '7.50%',
          icon: USDT_ICON,
        },
      ].map((item) => (
        <SelectableRow
          key={item.id}
          testID={`selectable-row-${item.id}`}
          accessibilityLabel={`${item.name}, ${item.description}, ${item.value}`}
          selected={selected === item.id}
          onPress={() => setSelected(item.id)}
          leading={<Token size="md" tokenImageUri={item.icon} />}
          trailing={
            <XStack gap="$3" alignItems="center">
              <SizableText size="$bodyMdMedium" color="$textSuccess">
                {item.value}
              </SizableText>
              <SelectionMark selected={selected === item.id} />
            </XStack>
          }
          action={
            <IconButton
              testID={`selectable-row-action-${item.id}`}
              icon="InfoCircleOutline"
              variant="tertiary"
              accessibilityLabel={`Show information for ${item.name}`}
              onPress={() => setActionCount((current) => current + 1)}
            />
          }
        >
          <ListItem.Text primary={item.name} secondary={item.description} />
        </SelectableRow>
      ))}
      <SelectableRow
        testID="selectable-row-disabled"
        accessibilityLabel="Unavailable item"
        selected={false}
        disabled
        onPress={() => setSelected('disabled')}
        leading={<Token size="md" />}
        trailing={<SelectionMark selected={false} />}
        reserveActionSpace
      >
        <ListItem.Text primary="Unavailable item" secondary="Disabled state" />
      </SelectableRow>
      <SizableText size="$bodySm" color="$textSubdued">
        {`Independent action presses: ${actionCount}`}
      </SizableText>
    </YStack>
  );
}

function CardExample() {
  const [selected, setSelected] = useState(false);
  return (
    <YStack
      width="100%"
      maxWidth={408}
      bg="$bgSubdued"
      borderRadius="$3"
      overflow="hidden"
    >
      <SelectableRow
        testID="selectable-row-card"
        accessibilityLabel="Sample option, 2.86 percent APR"
        selected={selected}
        onPress={() => setSelected(!selected)}
        minHeight={74}
        horizontalPadding="$4"
        leading={<Token size="md" tokenImageUri={ETH_ICON} />}
        trailing={
          <XStack alignItems="center" gap="$3">
            <SizableText size="$bodyLgMedium">2.86% APR</SizableText>
            <Icon
              name={selected ? 'CheckRadioSolid' : 'CirclePlaceholderOnOutline'}
              size="$6"
              color={selected ? '$iconSuccess' : '$iconSubdued'}
            />
          </XStack>
        }
      >
        <ListItem.Text
          primary="Sample option"
          secondary="Secondary description"
        />
      </SelectableRow>
      {selected ? (
        <XStack
          px="$4"
          pb="$4"
          justifyContent="space-between"
          alignItems="center"
        >
          <SizableText size="$bodySm" color="$textSubdued">
            Additional details
          </SizableText>
          <Button size="small" onPress={() => setSelected(false)}>
            Close
          </Button>
        </XStack>
      ) : null}
    </YStack>
  );
}

function InteractionExample() {
  const [selected, setSelected] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [actionCount, setActionCount] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  return (
    <YStack width="100%" maxWidth={640} gap="$3">
      <SelectableRow
        testID="selectable-row-interaction"
        accessibilityLabel="Interactive sample"
        selected={selected}
        disabled={disabled}
        onPress={() => setSelected((value) => !value)}
        action={
          <IconButton
            testID="selectable-row-interaction-action"
            icon="InfoCircleOutline"
            variant="tertiary"
            accessibilityLabel="Sample information action"
            onPress={() => setActionCount((value) => value + 1)}
          />
        }
      >
        <ListItem.Text
          primary="Interactive sample"
          secondary="Select or focus this row"
        />
      </SelectableRow>
      <SizableText testID="selectable-row-interaction-status" size="$bodySm">
        {`${disabled ? 'Disabled' : 'Enabled'} · ${selected ? 'Selected' : 'Not selected'} · Actions: ${actionCount}`}
      </SizableText>
      <XStack gap="$2" flexWrap="wrap">
        <Button
          testID="selectable-row-interaction-toggle-disabled"
          size="small"
          onPress={() => {
            clearTimeout(timer.current);
            setDisabled((value) => !value);
          }}
        >
          {disabled ? 'Enable row' : 'Disable row'}
        </Button>
        <Button
          testID="selectable-row-interaction-delayed-disable"
          size="small"
          onPress={() => {
            clearTimeout(timer.current);
            setDisabled(false);
            timer.current = setTimeout(() => setDisabled(true), 2000);
          }}
        >
          Disable in 2 seconds
        </Button>
      </XStack>
    </YStack>
  );
}

export default function SelectableRowGallery() {
  return (
    <Layout
      componentName="SelectableRow"
      wideScreen
      elements={[
        {
          title: 'Rows: selected, disabled and independent action',
          element: <RowExamples />,
        },
        { title: 'Composed card', element: <CardExample /> },
        { title: 'Interaction states', element: <InteractionExample /> },
      ]}
    />
  );
}
