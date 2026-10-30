import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { IStakeEarnDetail } from '@onekeyhq/shared/types/staking';

import { EARN_DESKTOP_DEMO_COPY } from '../../components/desktopHome/earnDesktopHomeCopy';
import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';
import {
  buildHeadlineApyParts,
  isYieldSheetAvailable,
} from '../EarnProtocolDetails/mobile/yieldSegments.utils';

import { getOfferSymbol } from './EarnRouterOffer';

import type { IEarnDesktopHoldOffer } from '../../components/desktopHome/earnDesktopHome.utils';

// What a vault's details page says, read once an offer is picked and kept
// while the app runs, so picking it again shows its facts at once
const detailCache = new Map<string, IStakeEarnDetail>();

const getDetailParams = (offer: IEarnDesktopHoldOffer, symbol: string) => {
  if (offer.kind === 'lending') {
    return undefined;
  }
  const providerName = offer.item.provider.name;
  return {
    networkId: offer.item.network.networkId,
    symbol: getOfferSymbol(offer, symbol),
    provider: providerName,
    vault: earnUtils.shouldSendEarnProtocolVault({ providerName })
      ? offer.item.provider.vault
      : undefined,
  };
};

const getDetailKey = (
  params: NonNullable<ReturnType<typeof getDetailParams>>,
) =>
  [params.networkId, params.symbol, params.provider, params.vault ?? ''].join(
    '|',
  );

// A vault's details, for the card the window's form is on. Pendle's facts
// are on its list row and a market's are in the form, so neither reads them.
// A card no longer picked keeps what it read while it folds
function useOfferDetail({
  offer,
  symbol,
  enabled,
}: {
  offer: IEarnDesktopHoldOffer;
  symbol: string;
  enabled: boolean;
}) {
  const params = offer.isFixedRate ? undefined : getDetailParams(offer, symbol);
  const key = params ? getDetailKey(params) : undefined;
  const [, setReadKey] = useState<string>();
  useEffect(() => {
    if (!enabled || !params || !key || detailCache.has(key)) {
      return undefined;
    }
    let isCurrent = true;
    backgroundApiProxy.serviceStaking
      .getProtocolDetailsV2(params)
      .then((result) => {
        detailCache.set(key, result);
        if (isCurrent) {
          setReadKey(key);
        }
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
    // The key stands for the params
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);
  return key ? detailCache.get(key) : undefined;
}

// The first sentence of the protocol's tip the details page shows inline,
// its markup taken out
const getTipSentence = (detail?: IStakeEarnDetail) => {
  const tips = detail?.protocolTips?.tips;
  if (!tips?.length) {
    return undefined;
  }
  const tip = tips.find((item) => item.showDefault) ?? tips[0];
  const text = tip.description?.text
    ?.replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) {
    return undefined;
  }
  const end = text.search(/[.!?。](\s|$)/);
  return end >= 0 ? text.slice(0, end + 1) : text;
};

function FactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <XStack ai="center" jc="space-between" gap="$3" minHeight="$5">
      <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
        {label}
      </SizableText>
      <XStack ai="center" gap="$1" flexShrink={1} minWidth={0} jc="flex-end">
        {children}
      </XStack>
    </XStack>
  );
}

/**
 * Under the card the form is on, what tells it apart before depositing,
 * so the details page is a choice and not a step: a vault's base and bonus
 * rate, when the bonus ends, its tip and what is already in it; a fixed
 * rate's maturity and that leaving early is at the market's price. Then
 * Details, which goes to the page with the amount and the Pay with token
 */
export function EarnOfferFacts({
  offer,
  symbol,
  isShown,
  depositedFiatValue,
  onDetails,
}: {
  offer: IEarnDesktopHoldOffer;
  symbol: string;
  // The card is the one picked: its facts are read and show
  isShown: boolean;
  // What the portfolio holds in this offer, in the display currency
  depositedFiatValue?: number;
  onDetails: (offer: IEarnDesktopHoldOffer) => void;
}) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const detail = useOfferDetail({ offer, symbol, enabled: isShown });
  const handleDetails = useCallback(() => onDetails(offer), [offer, onDetails]);

  const popup =
    detail?.apyDetail?.button?.type === 'popup'
      ? detail.apyDetail.button.data
      : undefined;
  const yieldData = isYieldSheetAvailable(popup) ? popup : undefined;
  const apyParts = buildHeadlineApyParts(
    yieldData?.items,
    yieldData?.yieldSummary?.totalApy?.description?.text,
  );
  const campaignEnd = yieldData?.yieldSummary?.campaignEnd?.endTime;
  // The token a bonus is paid in, where every part of it is in one
  const bonusSymbols = [
    ...new Set(
      (yieldData?.items ?? [])
        .filter((item) => item.kind === 'campaign' || item.kind === 'reward')
        .map((item) => (item.yieldToken ?? item.token)?.info.symbol)
        .filter(Boolean),
    ),
  ];
  const bonusSymbol = bonusSymbols.length === 1 ? bonusSymbols[0] : undefined;
  // A tip about the bonus says what its rows already do (Spark's: the
  // campaign's dates and pool); another tip says something they don't
  let tipSentence = offer.isFixedRate ? undefined : getTipSentence(detail);
  if (apyParts?.bonus && tipSentence && /campaign|bonus/i.test(tipSentence)) {
    tipSentence = undefined;
  }
  const maturity =
    offer.kind === 'protocol' && offer.isFixedRate
      ? offer.item.provider.maturity
      : undefined;

  const rows: ReactNode[] = [];
  // The split only where there is a bonus: the card's rate is the base
  // otherwise
  if (apyParts?.bonus) {
    rows.push(
      <FactRow
        key="base"
        label={intl.formatMessage({ id: ETranslations.earn_base_apy })}
      >
        <SizableText size="$bodyMdMedium">{apyParts.base}</SizableText>
      </FactRow>,
      <FactRow key="bonus" label={EARN_DESKTOP_DEMO_COPY.bonusApy}>
        <SizableText size="$bodyMdMedium" color={apyParts.bonusColor}>
          {apyParts.bonus}
        </SizableText>
        {bonusSymbol ? (
          <SizableText size="$bodyMd" color="$textSubdued">
            {EARN_DESKTOP_DEMO_COPY.paidIn(bonusSymbol)}
          </SizableText>
        ) : null}
      </FactRow>,
    );
  }
  if (apyParts?.bonus && campaignEnd) {
    rows.push(
      <FactRow key="ends" label={EARN_DESKTOP_DEMO_COPY.bonusEnds}>
        <SizableText size="$bodyMdMedium">
          {intl.formatDate(new Date(campaignEnd), {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </SizableText>
      </FactRow>,
    );
  }
  if (maturity) {
    rows.push(
      <FactRow key="maturity" label={EARN_DESKTOP_DEMO_COPY.maturity}>
        <SizableText size="$bodyMdMedium">{maturity}</SizableText>
      </FactRow>,
    );
  }
  if (depositedFiatValue && depositedFiatValue > 0) {
    rows.push(
      <FactRow
        key="deposited"
        label={intl.formatMessage({ id: ETranslations.earn_deposited })}
      >
        <NumberSizeableTextWrapper
          hideValue
          size="$bodyMdMedium"
          formatter="value"
          formatterOptions={{ currency: settings.currencyInfo.symbol }}
        >
          {depositedFiatValue}
        </NumberSizeableTextWrapper>
      </FactRow>,
    );
  }
  let sentence = tipSentence;
  if (maturity) {
    sentence = EARN_DESKTOP_DEMO_COPY.fixedRateEarlySale;
  }

  return (
    <YStack gap="$2" pt="$3">
      {rows.length ? <YStack gap="$1.5">{rows}</YStack> : null}
      {sentence ? (
        <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={2}>
          {sentence}
        </SizableText>
      ) : null}
      <XStack
        testID="earn-offer-details"
        role="link"
        alignSelf="flex-start"
        ai="center"
        gap="$0.5"
        // The text keeps the facts' edge; the pressed fill reaches past it
        mx="$-1.5"
        px="$1.5"
        py="$0.5"
        borderRadius="$2"
        borderCurve="continuous"
        userSelect="none"
        cursor="pointer"
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        // The card under it is already the one picked
        onPress={(event: { stopPropagation: () => void }) => {
          event.stopPropagation();
          handleDetails();
        }}
        {...buildKeyboardPressProps(handleDetails, 2)}
      >
        <SizableText size="$bodyMdMedium">
          {intl.formatMessage({ id: ETranslations.global_details })}
        </SizableText>
        <Icon name="ChevronRightSmallOutline" size="$4" color="$iconSubdued" />
      </XStack>
    </YStack>
  );
}
