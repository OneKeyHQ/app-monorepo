import { memo } from 'react';

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

import { useAccountData } from '../../hooks/useAccountData';
import { useAggregateTokensListMapAtom } from '../../states/jotai/contexts/tokenList';

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

  const { network } = useAccountData({ networkId });
  const [aggregateTokensListMap] = useAggregateTokensListMapAtom();
  const { allAggregateTokenMap } = useTokenListViewContext();
  const allAggregateTokenList = allAggregateTokenMap?.[$key]?.tokens ?? [];
  const aggregateTokenList = aggregateTokensListMap[$key]?.tokens ?? [];
  const firstAggregateToken = aggregateTokenList?.[0];
  const { network: firstAggregateTokenNetwork } = useAccountData({
    networkId: firstAggregateToken?.networkId,
  });

  return (
    <XStack alignItems="center" gap="$1" {...rest}>
      <SizableText minWidth={0} numberOfLines={1} {...textProps}>
        {name}
      </SizableText>
      {isAllNetworks &&
      withAggregateBadge &&
      isAggregateToken &&
      (aggregateTokenList?.length > 1 || allAggregateTokenList?.length > 1) ? (
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
          allAggregateTokenList.length === 0)) ? (
        <Badge flexShrink={1}>
          <Badge.Text numberOfLines={1}>
            {network?.isAggregateNetwork
              ? firstAggregateTokenNetwork?.name
              : network?.name || firstAggregateTokenNetwork?.name}
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
