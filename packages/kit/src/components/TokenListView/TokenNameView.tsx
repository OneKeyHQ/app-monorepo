import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ISizableTextProps, IXStackProps } from '@onekeyhq/components';
import {
  Badge,
  Icon,
  SizableText,
  Tooltip,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { checkIsOnlyOneTokenHasBalance } from '@onekeyhq/shared/src/utils/tokenUtils';

import { useAggregateSubTokenFiatMap } from '../../states/jotai/contexts/tokenList/cells';

import { useTokenListViewContext } from './TokenListViewContext';

type IProps = {
  $key: string;
  name: string;
  isNative?: boolean;
  isAggregateToken?: boolean;
  isAllNetworks?: boolean;
  withNetwork?: boolean;
  networkId: string | undefined;
  textProps?: ISizableTextProps;
  withAggregateBadge?: boolean;
  showNetworkName?: boolean;
  showDeFiReceiptTokenBadge?: boolean;
} & IXStackProps;

function TokenNameView(props: IProps) {
  const {
    $key,
    name,
    isNative,
    isAggregateToken,
    isAllNetworks,
    withNetwork,
    networkId,
    textProps,
    withAggregateBadge,
    showNetworkName,
    showDeFiReceiptTokenBadge,
    ...rest
  } = props;
  const intl = useIntl();

  const {
    allAggregateTokenMap,
    ownedAggregateTokenListMap,
    networksMap,
    tokenListMap: contextTokenListMap,
    useCellSeam,
  } = useTokenListViewContext();
  const allAggregateTokenList = useMemo(
    () => allAggregateTokenMap?.[$key]?.tokens ?? [],
    [allAggregateTokenMap, $key],
  );
  const aggregateTokenList = useMemo(
    () => ownedAggregateTokenListMap?.[$key]?.tokens ?? [],
    [ownedAggregateTokenListMap, $key],
  );
  const firstAggregateToken = aggregateTokenList?.[0];
  const shouldShowDeFiReceiptTokenBadge =
    showDeFiReceiptTokenBadge && !platformEnv.isNative;

  // Per-network sub-token fiat slice (red-team C-F2): the home cell-seam reads
  // the live sub-cells; non-cell paths read the host-provided map. NEVER the
  // summed aggCell — these keys are per-network sub-token `$key`s.
  const subTokenFiatMap = useAggregateSubTokenFiatMap({
    aggKey: $key,
    aggregateTokenList,
    useCellSeam,
    contextTokenListMap,
  });

  const { tokenHasBalance, tokenHasBalanceCount } = useMemo(() => {
    return checkIsOnlyOneTokenHasBalance({
      tokenMap: subTokenFiatMap,
      aggregateTokenList,
      allAggregateTokenList,
    });
  }, [aggregateTokenList, subTokenFiatMap, allAggregateTokenList]);

  const network = useMemo(() => {
    if (!networkId) return undefined;
    return (
      networksMap?.[networkId] ?? networkUtils.getLocalNetworkInfo(networkId)
    );
  }, [networksMap, networkId]);

  const firstAggregateTokenNetwork = useMemo(() => {
    const id = firstAggregateToken?.networkId;
    if (!id) return undefined;
    return networksMap?.[id] ?? networkUtils.getLocalNetworkInfo(id);
  }, [firstAggregateToken?.networkId, networksMap]);

  const tokenHasBalanceNetwork = useMemo(() => {
    const id = tokenHasBalance?.networkId;
    if (!id) return undefined;
    return networksMap?.[id] ?? networkUtils.getLocalNetworkInfo(id);
  }, [networksMap, tokenHasBalance?.networkId]);

  return (
    <XStack alignItems="center" gap="$1" {...rest}>
      <SizableText minWidth={0} numberOfLines={1} {...textProps}>
        {name}
      </SizableText>
      {shouldShowDeFiReceiptTokenBadge ? (
        <Tooltip
          renderContent={intl.formatMessage({
            id: ETranslations.wallet_defi_receipt_token__desc,
          })}
          renderTrigger={
            <Icon
              flexShrink={0}
              name="TicketOutline"
              color="$iconSubdued"
              size="$5"
            />
          }
        />
      ) : null}
      {isAllNetworks &&
      withAggregateBadge &&
      isAggregateToken &&
      (aggregateTokenList?.length > 1 || allAggregateTokenList?.length > 1) &&
      !tokenHasBalance ? (
        <Badge flexShrink={1}>
          <Badge.Text numberOfLines={1}>
            {intl.formatMessage({ id: ETranslations.global__multichain })}
          </Badge.Text>
        </Badge>
      ) : null}
      {withNetwork &&
      ((network && !network.isAggregateNetwork && !isAggregateToken) ||
        (firstAggregateTokenNetwork &&
          aggregateTokenList?.length === 1 &&
          allAggregateTokenList.length === 0) ||
        (tokenHasBalance && tokenHasBalanceCount === 1)) ? (
        <Badge flexShrink={1}>
          <Badge.Text numberOfLines={1}>
            {network?.isAggregateNetwork
              ? (tokenHasBalanceNetwork?.name ??
                firstAggregateTokenNetwork?.name)
              : ((network?.name || tokenHasBalanceNetwork?.name) ??
                firstAggregateTokenNetwork?.name)}
          </Badge.Text>
        </Badge>
      ) : null}
      {isNative && !isAllNetworks && !showNetworkName ? (
        <Tooltip
          renderContent={intl.formatMessage({
            id: ETranslations.native_token_tooltip,
          })}
          renderTrigger={
            <Icon
              flexShrink={0}
              name="GasSolid"
              color="$iconSubdued"
              size="$5"
            />
          }
        />
      ) : null}
    </XStack>
  );
}

export default memo(TokenNameView);
