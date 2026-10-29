import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Icon,
  Input,
  Page,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { EARN_DESKTOP_DEMO_COPY } from '../../components/desktopHome/earnDesktopHomeCopy';
import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';
import { EARN_PAY_WITH_PICKER_SIZE } from '../EarnRouter/earnPayWithPickerData';

import { getEarnAssetClassLabel } from './earnAssetClassLabel';
import { EarnAssetLogos } from './EarnAssetLogos';
import {
  buildAssetSelectGroups,
  isAddressKeyword,
  isSameAssetPick,
  searchAssetSelect,
  splitClassMembers,
} from './earnAssetSelect.utils';

import type {
  IEarnAssetPick,
  IEarnAssetSelectClassRow,
  IEarnAssetSelectGroup,
  IEarnAssetSelectPurpose,
  IEarnAssetSelectToken,
} from './earnAssetSelect.utils';

// The rows sit where Pay with's picker puts its own: inset from the modal's
// edges, their content 20px in at either width
const ROW_INSET_WIDE = { mx: '$4', px: '$1' } as const;
// A kind's tokens step in under its row, as Swap's networks under theirs;
// the line runs under the middle of the kind's first logo
const INDENT = 28;
const ROW_CONTENT_LEFT = 20;
const LOGO_RING_SIZE = 28;
const GUIDE_LEFT = ROW_CONTENT_LEFT + LOGO_RING_SIZE / 2 - 0.75;

const formatRate = (rate: number) => `${rate.toFixed(2)}%`;
// From the figures' right edge to the row's: the check, the menu, their gaps
const FIGURE_END_INSET = 20 + 24 + 12 * 2;
// The picked row, which the list opens on
const SELECTED_ROW_TEST_ID = 'earn-asset-select-picked';

type IRowPlace = {
  isWide: boolean;
  indented?: boolean;
};

const rowSpacing = ({ isWide, indented }: IRowPlace) => {
  const base = isWide ? ROW_INSET_WIDE : undefined;
  if (!indented) {
    return base;
  }
  // The row's own inset, then the step in
  return { ...base, ml: (isWide ? 16 : 8) + INDENT };
};

// What the row's right side says: Earn's best rate, a loan's lowest, or what
// the wallet holds of a collateral
function RowFigure({
  purpose,
  rate,
  balance,
  fiatValue,
}: {
  purpose: IEarnAssetSelectPurpose;
  rate?: number;
  balance?: string;
  fiatValue?: number;
}) {
  if (purpose === 'loanSupply') {
    return (
      <YStack ai="flex-end" flexShrink={0} gap="$0.5">
        {balance ? (
          <NumberSizeableTextWrapper
            hideValue
            size="$bodyLgMedium"
            formatter="balance"
            numberOfLines={1}
          >
            {balance}
          </NumberSizeableTextWrapper>
        ) : null}
        {fiatValue ? (
          <Currency
            hideValue
            size={balance ? '$bodyMd' : '$bodyLgMedium'}
            color={balance ? '$textSubdued' : undefined}
            formatter="value"
            sourceCurrency={USD_CURRENCY_ID}
            numberOfLines={1}
          >
            {String(fiatValue)}
          </Currency>
        ) : null}
      </YStack>
    );
  }
  return (
    <YStack ai="flex-end" flexShrink={0} gap="$0.5">
      {rate !== undefined ? (
        <SizableText
          size="$bodyLgMedium"
          color={purpose === 'earn' ? '$textSuccess' : undefined}
          numberOfLines={1}
        >
          {formatRate(rate)}
        </SizableText>
      ) : null}
      {purpose === 'earn' && fiatValue ? (
        <Currency
          hideValue
          size="$bodyMd"
          color="$textSubdued"
          formatter="value"
          sourceCurrency={USD_CURRENCY_ID}
          numberOfLines={1}
        >
          {String(fiatValue)}
        </Currency>
      ) : null}
    </YStack>
  );
}

// The pick's check, its place kept on every row so the figures line up
function RowCheck({ isSelected }: { isSelected: boolean }) {
  return isSelected ? (
    <Icon
      name="CheckLargeOutline"
      size="$5"
      color="$iconSuccess"
      flexShrink={0}
    />
  ) : (
    <Stack w="$5" h="$5" flexShrink={0} />
  );
}

// Where the token is offered when that is more than one network: their logos
// after its name
function NetworkLogos({ token }: { token: IEarnAssetSelectToken }) {
  if (token.networks.length < 2) {
    return null;
  }
  const shown = token.networks.slice(0, 3);
  return (
    <XStack ai="center" gap="$1" flexShrink={0}>
      {shown.map((network) => (
        <Token key={network.id} size="xxs" tokenImageUri={network.logoURI} />
      ))}
      {token.networks.length > shown.length ? (
        <SizableText size="$bodySm" color="$textSubdued">
          {`+${token.networks.length - shown.length}`}
        </SizableText>
      ) : null}
    </XStack>
  );
}

function TokenMenu({ token }: { token: IEarnAssetSelectToken }) {
  const intl = useIntl();
  const { copyText } = useClipboard();
  // One contract to name: a network's own coin has none, a token offered on
  // several networks has one on each
  const contract =
    token.addresses.length === 1 && token.networks.length === 1
      ? token.addresses[0]
      : undefined;
  return (
    <Stack alignSelf="center">
      <ActionList
        title={token.symbol}
        disabled={!contract}
        renderTrigger={
          <ListItem.IconButton icon="DotVerSolid" variant="tertiary" />
        }
        items={[
          {
            icon: 'Copy3Outline',
            label: intl.formatMessage({
              id: ETranslations.global_copy_token_contract,
            }),
            onPress: () => {
              if (contract) {
                copyText(contract.address);
              }
            },
            disabled: !contract,
          },
          {
            icon: 'OpenOutline',
            label: intl.formatMessage({
              id: ETranslations.swap_token_selector_contract_info,
            }),
            onPress: async () => {
              if (!contract) {
                return;
              }
              const url =
                await backgroundApiProxy.serviceExplorer.buildExplorerUrl({
                  networkId: contract.networkId,
                  type: 'token',
                  param: contract.address,
                });
              openUrlExternal(url);
            },
            disabled: !contract,
          },
        ]}
      />
    </Stack>
  );
}

function TokenRow({
  token,
  purpose,
  isSelected,
  place,
  matchedAddress,
  onPick,
}: {
  token: IEarnAssetSelectToken;
  purpose: IEarnAssetSelectPurpose;
  isSelected: boolean;
  place: IRowPlace;
  matchedAddress?: string;
  onPick: (pick: IEarnAssetPick) => void;
}) {
  const press = useCallback(
    () => onPick({ kind: 'token', symbol: token.symbol }),
    [onPick, token.symbol],
  );
  const network = token.networks.length === 1 ? token.networks[0] : undefined;
  return (
    <ListItem
      testID={
        isSelected
          ? SELECTED_ROW_TEST_ID
          : `earn-asset-select-token-${token.symbol}`
      }
      role="option"
      aria-selected={isSelected}
      userSelect="none"
      onPress={press}
      {...rowSpacing(place)}
      {...(isSelected ? { bg: '$bgHover' } : undefined)}
      {...buildKeyboardPressProps(press)}
    >
      <Token tokenImageUri={token.logoURI} networkImageUri={network?.logoURI} />
      <ListItem.Text
        flex={1}
        primary={token.symbol}
        primaryTextProps={{ numberOfLines: 1 }}
        secondary={
          <XStack ai="center" gap="$1.5" minWidth={0}>
            <SizableText
              size="$bodyMd"
              color="$textSubdued"
              numberOfLines={1}
              flexShrink={1}
            >
              {token.name}
            </SizableText>
            {matchedAddress ? (
              <SizableText size="$bodyMd" color="$textDisabled" flexShrink={0}>
                {accountUtils.shortenAddress({
                  address: matchedAddress,
                  leadingLength: 6,
                  trailingLength: 4,
                })}
              </SizableText>
            ) : (
              <NetworkLogos token={token} />
            )}
          </XStack>
        }
      />
      <RowFigure
        purpose={purpose}
        rate={token.rate}
        balance={token.balance}
        fiatValue={token.fiatValue}
      />
      <RowCheck isSelected={isSelected} />
      <TokenMenu token={token} />
    </ListItem>
  );
}

// A kind's row: its first logos together, its name and its first tokens; a
// pick compares every token of it
function ClassRow({
  row,
  purpose,
  isSelected,
  place,
  onPick,
}: {
  row: IEarnAssetSelectClassRow;
  purpose: IEarnAssetSelectPurpose;
  isSelected: boolean;
  place: IRowPlace;
  onPick: (pick: IEarnAssetPick) => void;
}) {
  const intl = useIntl();
  const press = useCallback(
    () => onPick({ kind: 'class', assetClass: row.assetClass }),
    [onPick, row.assetClass],
  );
  const { shown, rest } = splitClassMembers(row.tokens);
  return (
    <ListItem
      testID={
        isSelected
          ? SELECTED_ROW_TEST_ID
          : `earn-asset-select-class-${row.assetClass}`
      }
      role="option"
      aria-selected={isSelected}
      userSelect="none"
      onPress={press}
      {...rowSpacing(place)}
      {...(isSelected ? { bg: '$bgHover' } : undefined)}
      {...buildKeyboardPressProps(press)}
    >
      {/* Its logos take a token logo's height, centered on it */}
      <Stack h="$10" jc="center">
        <EarnAssetLogos logos={row.tokens.map((token) => token.logoURI)} />
      </Stack>
      <ListItem.Text
        flex={1}
        primary={getEarnAssetClassLabel(intl, row.assetClass)}
        primaryTextProps={{ numberOfLines: 1 }}
        secondary={EARN_DESKTOP_DEMO_COPY.classMembers(shown, rest)}
        secondaryTextProps={{ numberOfLines: 1 }}
      />
      <RowFigure purpose={purpose} rate={row.rate} fiatValue={row.fiatValue} />
      <RowCheck isSelected={isSelected} />
      {/* A token row's menu place (its button's width), so the figures
          line up with theirs */}
      <Stack w="$6" flexShrink={0} />
    </ListItem>
  );
}

function AssetGroup({
  group,
  purpose,
  selected,
  isWide,
  onPick,
}: {
  group: IEarnAssetSelectGroup;
  purpose: IEarnAssetSelectPurpose;
  selected?: IEarnAssetPick;
  isWide: boolean;
  onPick: (pick: IEarnAssetPick) => void;
}) {
  const intl = useIntl();
  const isTokenSelected = (token: IEarnAssetSelectToken) =>
    Boolean(
      selected &&
      isSameAssetPick(selected, { kind: 'token', symbol: token.symbol }),
    );
  const { classRow } = group;
  if (classRow) {
    return (
      <YStack testID={`earn-asset-select-group-${group.key}`}>
        <ClassRow
          row={classRow}
          purpose={purpose}
          isSelected={Boolean(
            selected &&
            isSameAssetPick(selected, {
              kind: 'class',
              assetClass: classRow.assetClass,
            }),
          )}
          place={{ isWide }}
          onPick={onPick}
        />
        <YStack>
          {/* One line down the whole group, under the kind's logos */}
          <Stack
            position="absolute"
            left={GUIDE_LEFT}
            top="$0"
            bottom="$0"
            width={1.5}
            bg="$borderSubdued"
          />
          {group.tokens.map((token) => (
            <TokenRow
              key={token.symbol}
              token={token}
              purpose={purpose}
              isSelected={isTokenSelected(token)}
              place={{ isWide, indented: true }}
              onPick={onPick}
            />
          ))}
        </YStack>
      </YStack>
    );
  }
  return (
    <YStack testID={`earn-asset-select-group-${group.key}`}>
      {/* Others, as Swap names its list's parts */}
      {group.key === 'other' ? (
        <SizableText
          size={isWide ? '$bodyMdMedium' : '$bodyMd'}
          color="$textSubdued"
          px="$5"
          pt="$3"
          pb="$1"
        >
          {getEarnAssetClassLabel(intl, 'other')}
        </SizableText>
      ) : null}
      {group.tokens.map((token) => (
        <TokenRow
          key={token.symbol}
          token={token}
          purpose={purpose}
          isSelected={isTokenSelected(token)}
          place={{ isWide }}
          onPick={onPick}
        />
      ))}
    </YStack>
  );
}

function SearchEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <YStack
      testID="earn-asset-select-empty"
      flex={1}
      ai="center"
      jc="center"
      px="$5"
      py="$16"
      gap="$2"
    >
      <Icon name="SearchOutline" size="$6" color="$iconSubdued" />
      <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
        {title}
      </SizableText>
      <SizableText size="$bodySm" color="$textDisabled" textAlign="center">
        {description}
      </SizableText>
    </YStack>
  );
}

function EarnRouterAssetSelectPage() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.EarnRouterAssetSelect
  >();
  const {
    purpose,
    title,
    tokens,
    selected,
    networkName,
    modalHeight,
    onSelect,
  } = route.params;
  const { gtMd } = useMedia();
  const isWide = Boolean((platformEnv.isDesktop || platformEnv.isWeb) && gtMd);
  const { getClipboard } = useClipboard();

  const [keyword, setKeyword] = useState('');
  const groups = useMemo(
    () => buildAssetSelectGroups({ tokens, purpose }),
    [purpose, tokens],
  );
  const search = useMemo(
    () => searchAssetSelect({ groups, keyword, purpose }),
    [groups, keyword, purpose],
  );
  const isSearching = keyword.trim().length > 0;

  const handlePick = useCallback(
    (pick: IEarnAssetPick) => {
      navigation.popStack();
      onSelect(pick);
    },
    [navigation, onSelect],
  );
  const handlePaste = useCallback(async () => {
    const text = await getClipboard();
    if (text) {
      setKeyword(text.trim());
    }
  }, [getClipboard]);

  // The list opens on the pick, in the middle of the rows when it is far down
  // Once the rows are laid out (the modal mounts them a frame later), so the
  // scroll has a height to move in
  useEffect(() => {
    if (!platformEnv.isRuntimeBrowser) {
      return undefined;
    }
    let frame = 0;
    let tries = 0;
    const scrollToPick = () => {
      const node = document.querySelector<HTMLElement>(
        `[data-testid="${SELECTED_ROW_TEST_ID}"]`,
      );
      if (node?.getBoundingClientRect().height) {
        node.scrollIntoView({ block: 'center' });
        return;
      }
      tries += 1;
      if (tries < 10) {
        frame = requestAnimationFrame(scrollToPick);
      }
    };
    frame = requestAnimationFrame(scrollToPick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const placeholder = intl.formatMessage({
    id: ETranslations.token_selector_search_placeholder,
  });
  const listLabel =
    purpose === 'earn' && networkName
      ? intl.formatMessage(
          { id: ETranslations.title_tokens_on_network },
          { network: networkName },
        )
      : intl.formatMessage({ id: ETranslations.earn_tokens__title });
  let figureLabel = intl.formatMessage({ id: ETranslations.global_apy });
  if (purpose === 'loanSupply') {
    figureLabel = intl.formatMessage({
      id: ETranslations.global_wallet_balance,
    });
  } else if (purpose === 'loanBorrow') {
    figureLabel = intl.formatMessage({ id: ETranslations.defi_borrow_apy });
  }

  let emptyDescription = intl.formatMessage({
    id: ETranslations.description_check_spelling_or_paste_contract_address,
  });
  if (isAddressKeyword(keyword)) {
    emptyDescription =
      purpose === 'earn'
        ? EARN_DESKTOP_DEMO_COPY.assetSelectNoEarn(networkName ?? '')
        : EARN_DESKTOP_DEMO_COPY.assetSelectNoLoan;
  }

  let list: ReactNode;
  if (isSearching) {
    list =
      search.classRows.length || search.tokens.length ? (
        <>
          {search.classRows.map((row) => (
            <ClassRow
              key={row.assetClass}
              row={row}
              purpose={purpose}
              isSelected={Boolean(
                selected &&
                isSameAssetPick(selected, {
                  kind: 'class',
                  assetClass: row.assetClass,
                }),
              )}
              place={{ isWide }}
              onPick={handlePick}
            />
          ))}
          {search.tokens.map(({ token, matchedAddress }) => (
            <TokenRow
              key={token.symbol}
              token={token}
              purpose={purpose}
              isSelected={Boolean(
                selected &&
                isSameAssetPick(selected, {
                  kind: 'token',
                  symbol: token.symbol,
                }),
              )}
              place={{ isWide }}
              matchedAddress={matchedAddress}
              onPick={handlePick}
            />
          ))}
        </>
      ) : (
        <SearchEmpty
          title={intl.formatMessage({
            id: ETranslations.empty_no_tokens_found,
          })}
          description={emptyDescription}
        />
      );
  } else {
    list = groups.map((group) => (
      <AssetGroup
        key={group.key}
        group={group}
        purpose={purpose}
        selected={selected}
        isWide={isWide}
        onPick={handlePick}
      />
    ));
  }

  return (
    <Page lazyLoad={!platformEnv.isNativeIOS} safeAreaEnabled={false}>
      <Page.Header
        title={title}
        // As Pay with's picker: the app's usual modal width, and over a
        // taller modal, its height
        modalContentMaxWidth={
          isWide ? EARN_PAY_WITH_PICKER_SIZE.width : undefined
        }
        modalContentMaxHeight={
          isWide ? (modalHeight ?? EARN_PAY_WITH_PICKER_SIZE.height) : undefined
        }
        {...(!isWide
          ? {
              headerSearchBarOptions: {
                placeholder,
                onChangeText: ({ nativeEvent }) => {
                  setKeyword(nativeEvent.text);
                },
                searchBarInputValue: keyword,
                ...(keyword.length === 0 && !platformEnv.isExtension
                  ? {
                      addOns: [
                        {
                          iconName: 'ClipboardOutline' as const,
                          onPress: () => void handlePaste(),
                        },
                      ],
                    }
                  : {}),
              },
            }
          : {})}
      />
      <Page.Body>
        <YStack flex={1} minHeight={0} testID="earn-asset-select">
          {isWide ? (
            <YStack px="$4" pt="$3" pb="$2">
              <Input
                testID="earn-asset-select-search"
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
                allowPaste={keyword.length === 0}
                allowClear
                autoFocus
                value={keyword}
                placeholder={placeholder}
                onChangeText={setKeyword}
              />
            </YStack>
          ) : null}
          {/* The list's name, and what the figure on each row's right is */}
          <XStack h={38} ai="center" jc="space-between" pl="$5" pr="$5">
            <SizableText
              size={isWide ? '$bodyMdMedium' : '$bodyMd'}
              color="$textSubdued"
            >
              {listLabel}
            </SizableText>
            <SizableText
              size={isWide ? '$bodyMdMedium' : '$bodyMd'}
              color="$textSubdued"
              // Over the figures: they end before the check's place and the
              // menu's (20 + 24, with a 12 gap before each)
              pr={FIGURE_END_INSET}
            >
              {figureLabel}
            </SizableText>
          </XStack>
          <ScrollView flex={1} contentContainerStyle={{ paddingBottom: 12 }}>
            {list}
          </ScrollView>
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default EarnRouterAssetSelectPage;
