import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Image,
  Input,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export type IEarnAssetSelectColumnNetwork = {
  id: string;
  name: string;
  logoURI: string;
  // What the wallet holds there, in the currency
  fiatValue?: string;
};

export const EARN_ASSET_SELECT_NETWORK_COLUMN_WIDTH = 240;
// A handful of networks is read at a glance; a longer list gets its search
const SEARCH_FROM = 9;

// Swap's token selector's network row, to the pixel: the routers' selector
// is that selector with fewer networks
function NetworkRow({
  testID,
  name,
  logoURI,
  isAllNetworks,
  fiatValue,
  currencySymbol,
  isSelected,
  onPress,
}: {
  testID: string;
  name: string;
  logoURI?: string;
  isAllNetworks?: boolean;
  fiatValue?: string;
  currencySymbol: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  let logo = <Icon name="GlobusOutline" size="$6" color="$iconSubdued" />;
  if (isAllNetworks) {
    logo = <Icon name="AllNetworksSolid" size="$6" color="$iconActive" />;
  } else if (logoURI) {
    logo = <Image size="$6" borderRadius="$full" src={logoURI} />;
  }
  return (
    <XStack
      testID={testID}
      role="button"
      aria-pressed={isSelected}
      focusable
      userSelect="none"
      alignItems="center"
      height={44}
      px={9}
      gap="$2"
      borderWidth={1}
      borderColor={isSelected ? '$border' : '$transparent'}
      borderRadius="$3"
      bg={isSelected ? '$bgSubdued' : undefined}
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      focusVisibleStyle={{
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
        outlineWidth: 2,
        outlineOffset: 2,
      }}
      onPress={onPress}
    >
      {logo}
      <SizableText size="$bodyMdMedium" flex={1} minWidth={0} numberOfLines={1}>
        {name}
      </SizableText>
      {fiatValue ? (
        <NumberSizeableTextWrapper
          hideValue
          size="$bodySm"
          color="$textSubdued"
          formatter="value"
          formatterOptions={{ currency: currencySymbol }}
          numberOfLines={1}
          flexShrink={0}
        >
          {fiatValue}
        </NumberSizeableTextWrapper>
      ) : null}
    </XStack>
  );
}

/**
 * Where to look, beside the tokens: every network, then each network once,
 * the ones the wallet holds on first with what it holds there. Swap's column
 * lists a network up to three times because it has dozens; Earn and Loans
 * have a handful, so one list says it all, without section names or a
 * search (11-11)
 */
export function EarnAssetSelectNetworkColumn({
  networks,
  selectedId,
  allNetworksLabel,
  currencySymbol,
  onSelect,
}: {
  networks: IEarnAssetSelectColumnNetwork[];
  // None, every network
  selectedId?: string;
  allNetworksLabel: string;
  currencySymbol: string;
  onSelect: (networkId?: string) => void;
}) {
  const intl = useIntl();
  const [keyword, setKeyword] = useState('');
  const hasSearch = networks.length >= SEARCH_FROM;
  const shown = useMemo(() => {
    const words = keyword.trim().toLowerCase();
    return words
      ? networks.filter((item) => item.name.toLowerCase().includes(words))
      : networks;
  }, [keyword, networks]);
  const isSearching = keyword.trim().length > 0;
  return (
    <YStack
      testID="earn-asset-select-networks"
      width={EARN_ASSET_SELECT_NETWORK_COLUMN_WIDTH}
      minHeight={0}
      borderRightWidth={1}
      borderColor="$borderSubdued"
    >
      {hasSearch ? (
        <YStack p="$3" pb="$2">
          <Input
            testID="earn-asset-select-network-search"
            size="medium"
            height={38}
            pl={34}
            containerProps={{
              height: 38,
              bg: '$bgStrong',
              borderWidth: 0,
              borderRadius: '$3',
            }}
            leftIconName="SearchOutline"
            allowClear
            value={keyword}
            placeholder={intl.formatMessage({
              id: ETranslations.placeholder_search_networks,
            })}
            onChangeText={setKeyword}
          />
        </YStack>
      ) : null}
      <ScrollView
        flex={1}
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingTop: hasSearch ? 0 : 12,
          paddingBottom: 12,
        }}
      >
        {isSearching ? null : (
          <NetworkRow
            testID="earn-asset-select-network-all"
            name={allNetworksLabel}
            isAllNetworks
            currencySymbol={currencySymbol}
            isSelected={!selectedId}
            onPress={() => onSelect(undefined)}
          />
        )}
        {shown.map((item) => (
          <NetworkRow
            key={item.id}
            testID={`earn-asset-select-network-${item.id}`}
            name={item.name}
            logoURI={item.logoURI}
            fiatValue={item.fiatValue}
            currencySymbol={currencySymbol}
            isSelected={item.id === selectedId}
            onPress={() => onSelect(item.id)}
          />
        ))}
      </ScrollView>
    </YStack>
  );
}
