import { memo, useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Icon,
  IconButton,
  LinearGradient,
  Popover,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { sortTokensByOrder } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { useTokenDetailsContext } from './TokenDetailsContext';

type IProps = {
  tokens: IAccountToken[];
  onSelected: (token: IAccountToken) => void;
};

function TokenDetailsTabToolbar(props: IProps) {
  const { gtMd } = useMedia();
  const { tokens, onSelected } = props;
  const themeVariant = useThemeVariant();
  const intl = useIntl();
  const { tokenDetails, tokenAccountMap } = useTokenDetailsContext();
  const [settings] = useSettingsPersistAtom();

  const sortedTokensByFiatValue = useMemo(() => {
    let sortedTokens = tokens?.sort((a, b) => {
      const aKey = `${
        a.accountId ||
        tokenAccountMap[`${a.networkId || ''}_${a.address}`] ||
        ''
      }_${a.networkId || ''}`;
      const bKey = `${
        b.accountId ||
        tokenAccountMap[`${b.networkId || ''}_${b.address}`] ||
        ''
      }_${b.networkId || ''}`;
      const aFiat = new BigNumber(tokenDetails[aKey]?.data?.fiatValue ?? -1);
      const bFiat = new BigNumber(tokenDetails[bKey]?.data?.fiatValue ?? -1);

      return new BigNumber(bFiat.isNaN() ? -1 : bFiat).comparedTo(
        new BigNumber(aFiat.isNaN() ? -1 : aFiat),
      );
    });
    let index = sortedTokens.findIndex((t) => {
      const key = `${
        t.accountId ||
        tokenAccountMap[`${t.networkId || ''}_${t.address}`] ||
        ''
      }_${t.networkId || ''}`;
      return new BigNumber(
        tokenDetails[key]?.data?.fiatValue ?? -1,
      ).isNegative();
    });

    if (index === -1) {
      index = sortedTokens.findIndex((t) => {
        const key = `${
          t.accountId ||
          tokenAccountMap[`${t.networkId || ''}_${t.address}`] ||
          ''
        }_${t.networkId || ''}`;
        return new BigNumber(tokenDetails[key]?.data?.fiatValue ?? -1).isZero();
      });
    }

    if (index > -1) {
      const tokensWithBalance = sortedTokens.slice(0, index);
      let tokensWithZeroBalance = sortedTokens.slice(index);

      tokensWithZeroBalance = sortTokensByOrder({
        tokens: tokensWithZeroBalance,
      });

      sortedTokens = [...tokensWithBalance, ...tokensWithZeroBalance];
    }

    return sortedTokens;
  }, [tokens, tokenAccountMap, tokenDetails]);

  const renderContent = useCallback(
    ({ closePopover }: { closePopover: () => void }) => {
      return (
        <Stack
          pb="$2"
          $gtMd={{
            gap: '$0.5',
            py: '$1.5',
          }}
        >
          {sortedTokensByFiatValue?.map((token) => {
            const tokenDetailKey = `${
              token.accountId ||
              tokenAccountMap[`${token.networkId || ''}_${token.address}`] ||
              ''
            }_${token.networkId || ''}`;
            const tokenDetail = tokenDetails[tokenDetailKey]?.data;

            return (
              <ListItem
                key={token.$key}
                userSelect="none"
                onPress={async () => {
                  closePopover();
                  onSelected(token);
                }}
                $gtMd={{
                  px: '$1.5',
                  mx: '$1.5',
                  py: 5,
                  minHeight: 0,
                  gap: '$2',
                }}
              >
                <NetworkAvatar
                  networkId={token.networkId}
                  {...(gtMd && {
                    size: '$4',
                  })}
                />
                <SizableText
                  size="$bodyLg"
                  $gtMd={{
                    size: '$bodyMd',
                  }}
                  flex={1}
                >
                  {token.networkName}
                </SizableText>
                {tokenDetail?.fiatValue ? (
                  <ListItem.Text
                    align="right"
                    primary={
                      <NumberSizeableTextWrapper
                        hideValue
                        size="$bodyLg"
                        $gtMd={{
                          size: '$bodyMd',
                        }}
                        color="$textSubdued"
                        formatter="value"
                        formatterOptions={{
                          currency: settings.currencyInfo.symbol,
                        }}
                      >
                        {tokenDetail?.fiatValue}
                      </NumberSizeableTextWrapper>
                    }
                  />
                ) : (
                  <Tooltip
                    renderTrigger={
                      <Icon
                        name="RefreshCcwOutline"
                        size="$4"
                        color="$iconSubdued"
                      />
                    }
                    renderContent={intl.formatMessage({
                      id: ETranslations.network_enable_or_create_address,
                    })}
                  />
                )}
              </ListItem>
            );
          })}
        </Stack>
      );
    },
    [
      sortedTokensByFiatValue,
      tokenAccountMap,
      tokenDetails,
      gtMd,
      settings.currencyInfo.symbol,
      intl,
      onSelected,
    ],
  );

  if (tokens.length <= 1) {
    return null;
  }

  const shouldShowToolbar = gtMd ? tokens.length > 5 : tokens.length > 3;

  if (!shouldShowToolbar) {
    return null;
  }

  return (
    <XStack pr="$5">
      <LinearGradient
        colors={
          themeVariant === 'light'
            ? ['rgba(255,255,255,0)', 'rgba(255,255,255,1)']
            : ['rgba(15,15,15,0)', 'rgba(15,15,15,1)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        position="absolute"
        w="$5"
        left="$-5"
        top={0}
        bottom={0}
      />
      <Popover
        placement="bottom-end"
        floatingPanelProps={{
          width: 320,
          maxHeight: 372,
        }}
        sheetProps={{
          snapPoints: [92],
          snapPointsMode: 'percent',
        }}
        title={intl.formatMessage({
          id: ETranslations.global_select_network,
        })}
        renderTrigger={
          <IconButton variant="tertiary" icon="ChevronDownSmallOutline" />
        }
        renderContent={renderContent}
      />
    </XStack>
  );
}

export default memo(TokenDetailsTabToolbar);
