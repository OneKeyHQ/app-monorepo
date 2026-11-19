import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ColorTokens } from '@onekeyhq/components';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { buildKeyboardPressProps } from './earnDesktopPressable';
import { EarnHeaderPickCell } from './EarnHeaderPick';

export type IEarnHeaderNetworkMenuItem = {
  id: string;
  name: string;
  logoURI: string;
  // The pick's figure on this network, where the menu shows one (Earn's rate)
  figure?: string;
};

const MENU_WIDTH = 264;
const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];

// One network in the menu, a row of the selectors' network column: its
// logo, its name, the pick's figure there, and the check on the one in use
function NetworkMenuRow({
  testID,
  name,
  logoURI,
  isAllNetworks,
  figure,
  figureColor,
  isSelected,
  onPress,
}: {
  testID: string;
  name: string;
  logoURI?: string;
  isAllNetworks?: boolean;
  figure?: string;
  figureColor?: ColorTokens;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <XStack
      testID={testID}
      role="button"
      aria-pressed={isSelected}
      ai="center"
      gap="$2.5"
      h={44}
      px="$2"
      borderRadius="$2"
      borderCurve="continuous"
      userSelect="none"
      cursor="pointer"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={onPress}
      {...buildKeyboardPressProps(onPress)}
    >
      <NetworkAvatarBase
        logoURI={logoURI ?? ''}
        isAllNetworks={isAllNetworks}
        size="$6"
      />
      <SizableText size="$bodyMdMedium" flex={1} minWidth={0} numberOfLines={1}>
        {name}
      </SizableText>
      {figure ? (
        <SizableText
          size="$bodyMd"
          color={figureColor ?? '$textSubdued'}
          fontVariant={TABULAR_NUMS}
          flexShrink={0}
        >
          {figure}
        </SizableText>
      ) : null}
      {/* The check's place is kept, so the figures end on one line */}
      {isSelected ? (
        <Icon
          name="CheckLargeOutline"
          size="$4"
          color="$iconActive"
          flexShrink={0}
        />
      ) : (
        <Stack w="$4" h="$4" flexShrink={0} />
      )}
    </XStack>
  );
}

/**
 * The Earn and Loans windows' network field, and the menu under it: every
 * network, then each network the pick is on. A press there changes where,
 * and nothing else: what is picked stays, and no token list opens (11-11)
 */
export function EarnHeaderNetworkMenu({
  testID,
  selectedId,
  selected,
  networks,
  allFigure,
  figureColor,
  onSelect,
}: {
  testID: string;
  // None, every network
  selectedId?: string;
  // The network in use where the list doesn't name it (yet)
  selected?: { name?: string; logoURI?: string };
  networks: IEarnHeaderNetworkMenuItem[];
  allFigure?: string;
  figureColor?: ColorTokens;
  onSelect: (networkId?: string) => void;
}) {
  const intl = useIntl();
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const pick = useCallback(
    (networkId?: string) => {
      setIsOpen(false);
      if (networkId !== selectedId) {
        onSelect(networkId);
      }
    },
    [onSelect, selectedId],
  );
  const label = intl.formatMessage({ id: ETranslations.global_network });
  const allNetworksName = intl.formatMessage({
    id: ETranslations.global_all_networks,
  });
  const current = networks.find((item) => item.id === selectedId);
  return (
    <Popover
      title={label}
      open={isOpen}
      onOpenChange={setIsOpen}
      placement="bottom-start"
      floatingPanelProps={{ width: MENU_WIDTH }}
      renderTrigger={
        <EarnHeaderPickCell
          testID={testID}
          label={label}
          logo={
            <NetworkAvatarBase
              logoURI={current?.logoURI ?? selected?.logoURI ?? ''}
              isAllNetworks={!selectedId}
              size="$5"
            />
          }
          value={
            selectedId
              ? (current?.name ?? selected?.name ?? '')
              : allNetworksName
          }
          onPress={open}
        />
      }
      renderContent={
        <YStack testID={`${testID}-menu`} p="$1.5">
          <NetworkMenuRow
            testID={`${testID}-menu-all`}
            name={allNetworksName}
            isAllNetworks
            figure={allFigure}
            figureColor={figureColor}
            isSelected={!selectedId}
            onPress={() => pick(undefined)}
          />
          {networks.map((item) => (
            <NetworkMenuRow
              key={item.id}
              testID={`${testID}-menu-${item.id}`}
              name={item.name}
              logoURI={item.logoURI}
              figure={item.figure}
              figureColor={figureColor}
              isSelected={item.id === selectedId}
              onPress={() => pick(item.id)}
            />
          ))}
        </YStack>
      }
    />
  );
}
