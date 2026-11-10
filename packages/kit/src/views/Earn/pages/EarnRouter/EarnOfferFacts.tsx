import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { IStakeEarnDetail } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../../Staking/components/ProtocolDetails/EarnText';
import { EARN_DESKTOP_DEMO_COPY } from '../../components/desktopHome/earnDesktopHomeCopy';
import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';
import {
  buildHeadlineApyParts,
  isYieldSheetAvailable,
} from '../EarnProtocolDetails/mobile/yieldSegments.utils';

import { getOfferSymbol } from './EarnRouterOffer';

import type { IEarnDesktopHoldOffer } from '../../components/desktopHome/earnDesktopHome.utils';

type IProtocolTip = NonNullable<
  IStakeEarnDetail['protocolTips']
>['tips'][number];

const DAY_MS = 24 * 60 * 60 * 1000;
// Every line in the facts' panel, a figure's and the tip's
const FACT_ROW_HEIGHT = 24;

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

const stripMarkup = (text?: string) =>
  (text ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// The tip a card shows: the one on how the money comes back out, so every
// card answers the same question, else the one the details page shows
// first. Tips carry no type, so it goes by the English title the dashboard
// gives it, "About redemption" (demo 10-30); in another language the
// details page's pick stands
const pickCardTip = (detail?: IStakeEarnDetail): IProtocolTip | undefined => {
  const tips = (detail?.protocolTips?.tips ?? []).filter((tip) =>
    stripMarkup(tip.description?.text),
  );
  return (
    tips.find((tip) => /redemption/i.test(tip.title?.text ?? '')) ??
    tips.find((tip) => tip.showDefault) ??
    tips[0]
  );
};

// A tip's point, for one line: its first sentence up to the dash, colon or
// semicolon after which these tips go into the detail
const getTipClause = (tip: IProtocolTip) => {
  const text = stripMarkup(tip.description?.text);
  const end = text.search(/[.!?。](\s|$)/);
  const sentence = end >= 0 ? text.slice(0, end + 1) : text;
  const cut = sentence.search(/\s[—–]\s|[:;]\s/);
  return cut > 0 ? sentence.slice(0, cut) : sentence;
};

// A figure of the offer: its name over it, a cell in the card's strip
function FactCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <YStack gap="$0.5" minWidth={0} flexShrink={0}>
      <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
        {label}
      </SizableText>
      <XStack ai="center" gap="$1" minHeight={FACT_ROW_HEIGHT}>
        {children}
      </XStack>
    </YStack>
  );
}

function NoteTip({ text, tip }: { text: string; tip?: IProtocolTip }) {
  return tip ? (
    <YStack gap="$1">
      <EarnText text={tip.title} size="$bodySmMedium" />
      <EarnText text={tip.description} size="$bodySm" color="$textSubdued" />
    </YStack>
  ) : (
    text
  );
}

// The tip's point behind a mark, beside the figures: pointing at it shows
// the whole tip, worded as on the details page
function NoteMark({ text, tip }: { text: string; tip?: IProtocolTip }) {
  return (
    <Tooltip
      placement="top"
      contentProps={{ maxWidth: 320 }}
      renderTrigger={
        <XStack
          testID="earn-offer-note"
          aria-label={text}
          w="$6"
          h="$6"
          ai="center"
          jc="center"
          flexShrink={0}
        >
          <Icon name="InfoCircleOutline" size="$4" color="$iconSubdued" />
        </XStack>
      }
      renderContent={<NoteTip text={text} tip={tip} />}
    />
  );
}

// With no figure in the strip, the point itself in one line
function NoteLine({ text, tip }: { text: string; tip?: IProtocolTip }) {
  const line = (
    <XStack
      testID="earn-offer-note"
      ai="center"
      gap="$1.5"
      flex={1}
      minWidth={0}
      minHeight={FACT_ROW_HEIGHT}
    >
      <Icon
        name="InfoCircleOutline"
        size="$4"
        color="$iconSubdued"
        flexShrink={0}
      />
      <SizableText
        size="$bodyMd"
        color="$textSubdued"
        numberOfLines={1}
        flex={1}
        minWidth={0}
      >
        {text}
      </SizableText>
    </XStack>
  );
  if (!tip) {
    return line;
  }
  return (
    <Tooltip
      placement="top"
      triggerAsChild
      renderTrigger={line}
      contentProps={{ maxWidth: 320 }}
      renderContent={<NoteTip text={text} tip={tip} />}
    />
  );
}

/**
 * Under the card the form is on, what tells it apart before depositing,
 * so the details page is a choice and not a step. One strip: what is
 * already in it, a vault's bonus and how long it has left, a fixed rate's
 * maturity; then a mark for getting the money back out (the tip, or that
 * leaving a fixed rate early is at the market's price). A press on the
 * strip goes to the offer's page with the amount and the Pay with token
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
  const detailsLabel = intl.formatMessage({ id: ETranslations.global_details });

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
  const bonusDaysLeft = campaignEnd
    ? Math.ceil((Number(campaignEnd) - Date.now()) / DAY_MS)
    : 0;
  // The token a bonus is paid in, where every part of it is in one
  const bonusTokens = new Map<string, string | undefined>();
  (yieldData?.items ?? [])
    .filter((item) => item.kind === 'campaign' || item.kind === 'reward')
    .forEach((item) => {
      const info = (item.yieldToken ?? item.token)?.info;
      if (info?.symbol) {
        bonusTokens.set(info.symbol, info.logoURI);
      }
    });
  const [bonusToken] = bonusTokens.size === 1 ? [...bonusTokens] : [];
  // A tip about the bonus says what its rows already do (Spark's: the
  // campaign's dates and pool); another tip says something they don't
  let tip = offer.isFixedRate ? undefined : pickCardTip(detail);
  const tipClause = tip ? getTipClause(tip) : undefined;
  if (apyParts?.bonus && tipClause && /campaign|bonus/i.test(tipClause)) {
    tip = undefined;
  }
  const maturity =
    offer.kind === 'protocol' && offer.isFixedRate
      ? offer.item.provider.maturity
      : undefined;

  const cells: ReactNode[] = [];
  // What is already in it leads: the one figure that is the user's own
  if (depositedFiatValue && depositedFiatValue > 0) {
    cells.push(
      <FactCell
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
      </FactCell>,
    );
  }
  // The bonus alone: the card's rate is the total, and the base is what is
  // left of it
  if (apyParts?.bonus) {
    cells.push(
      <FactCell key="bonus" label={EARN_DESKTOP_DEMO_COPY.bonus}>
        <SizableText size="$bodyMdMedium" color={apyParts.bonusColor}>
          {apyParts.bonus}
        </SizableText>
        {/* The token it is paid in, by its logo: the form's earnings name
            it once an amount is in */}
        {bonusToken ? (
          <Stack aria-label={bonusToken[0]}>
            <Token size="xxs" tokenImageUri={bonusToken[1]} />
          </Stack>
        ) : null}
      </FactCell>,
    );
  }
  // How long the bonus has left, which is what weighs in a choice; its date
  // on hover
  if (apyParts?.bonus && campaignEnd && bonusDaysLeft > 0) {
    cells.push(
      <FactCell key="ends" label={EARN_DESKTOP_DEMO_COPY.endsIn}>
        <Tooltip
          placement="top"
          renderTrigger={
            <SizableText size="$bodyMdMedium">
              {EARN_DESKTOP_DEMO_COPY.days(bonusDaysLeft)}
            </SizableText>
          }
          renderContent={intl.formatDate(new Date(Number(campaignEnd)), {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        />
      </FactCell>,
    );
  }
  if (maturity) {
    cells.push(
      <FactCell key="maturity" label={EARN_DESKTOP_DEMO_COPY.maturity}>
        <SizableText size="$bodyMdMedium">{maturity}</SizableText>
      </FactCell>,
    );
  }
  // Getting the money back out: the tip, or that leaving a fixed rate early
  // is at the market's price. Beside the figures it is a mark with the
  // point behind it; with no figure, the strip's own line
  let noteText: string | undefined;
  let noteTip: IProtocolTip | undefined;
  if (maturity) {
    noteText = EARN_DESKTOP_DEMO_COPY.fixedRateEarlySale;
  } else if (tip && tipClause) {
    noteText = tipClause;
    noteTip = tip;
  }
  let lead: ReactNode = cells;
  if (!cells.length) {
    lead = noteText ? (
      <NoteLine text={noteText} tip={noteTip} />
    ) : (
      <SizableText size="$bodyMdMedium">{detailsLabel}</SizableText>
    );
  }

  // One strip under the card's row, and the way to the offer's page: its
  // figures a cell each, and a chevron at its end. A layer of its own in
  // the card: lighter than the picked card in the light theme, darker in
  // the dark one
  return (
    <XStack
      testID="earn-offer-details"
      role="link"
      aria-label={detailsLabel}
      mt="$3"
      ai="center"
      gap="$2"
      bg="$bgSubdued"
      borderRadius="$3"
      borderCurve="continuous"
      pl="$3"
      pr="$2"
      py="$2"
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
      <XStack
        flex={1}
        minWidth={0}
        ai="center"
        columnGap="$5"
        rowGap="$2"
        flexWrap="wrap"
      >
        {lead}
      </XStack>
      {cells.length && noteText ? (
        <NoteMark text={noteText} tip={noteTip} />
      ) : null}
      <Icon
        name="ChevronRightSmallOutline"
        size="$5"
        color="$iconSubdued"
        flexShrink={0}
      />
    </XStack>
  );
}
