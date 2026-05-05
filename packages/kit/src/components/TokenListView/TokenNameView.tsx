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
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { checkIsOnlyOneTokenHasBalance } from '@onekeyhq/shared/src/utils/tokenUtils';

import {
  useAggregateTokensListMapAtom,
  useAllTokenListMapAtom,
} from '../../states/jotai/contexts/tokenList';

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
    ...rest
  } = props;
  const intl = useIntl();

  const [aggregateTokensListMap] = useAggregateTokensListMapAtom();
  const { allAggregateTokenMap, networksMap } = useTokenListViewContext();
  const [allTokenListMap] = useAllTokenListMapAtom();
  const allAggregateTokenList = useMemo(
    () => allAggregateTokenMap?.[$key]?.tokens ?? [],
    [allAggregateTokenMap, $key],
  );
  const aggregateTokenList = useMemo(
    () => aggregateTokensListMap[$key]?.tokens ?? [],
    [aggregateTokensListMap, $key],
  );
  const firstAggregateToken = aggregateTokenList?.[0];

  const { tokenHasBalance, tokenHasBalanceCount } = useMemo(() => {
    return checkIsOnlyOneTokenHasBalance({
      tokenMap: allTokenListMap,
      aggregateTokenList,
      allAggregateTokenList,
    });
  }, [aggregateTokenList, allTokenListMap, allAggregateTokenList]);

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
