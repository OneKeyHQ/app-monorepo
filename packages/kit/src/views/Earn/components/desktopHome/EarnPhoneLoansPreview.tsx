import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Skeleton, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EARN_LIST_ROW_GAP } from '../earnListRhythm';
import { EarnPhoneSectionTitle } from '../EarnPhoneSectionTitle';

import {
  EarnDesktopLoanPairRow,
  useEarnDesktopLoanPairs,
} from './EarnDesktopBorrowTab';
import {
  EARN_DESKTOP_LOAN_LTV,
  pickLoanPreviewPairs,
} from './earnDesktopHome.utils';
import { EARN_DESKTOP_DEMO_COPY } from './earnDesktopHomeCopy';

import type {
  IEarnDesktopLoanPair,
  IEarnDesktopMarketReserves,
} from './earnDesktopHome.utils';

const PREVIEW_COUNT = 3;
// The Loans rows' height, as the list draws them
const ROW_HEIGHT = 56;

function PreviewSkeleton() {
  return (
    <YStack gap="$3">
      <XStack minHeight="$12" px="$pagePadding" py="$1" ai="center">
        <Skeleton w={72} h={20} borderRadius="$2" />
      </XStack>
      <YStack gap={EARN_LIST_ROW_GAP}>
        {Array.from({ length: PREVIEW_COUNT }).map((_, index) => (
          <XStack
            key={index}
            h={ROW_HEIGHT}
            mx="$2"
            px="$3"
            ai="center"
            gap="$3"
          >
            <Skeleton w={52} h={32} borderRadius="$full" />
            <YStack flex={1} gap="$1.5">
              <Skeleton w={96} h={14} borderRadius="$2" />
              <Skeleton w={72} h={12} borderRadius="$2" />
            </YStack>
            <Skeleton w={56} h={14} borderRadius="$2" />
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}

/**
 * Loans on the phone home: the first pairs of the Loans list as it opens,
 * each opening the Loans router on its pair. The title opens the whole list;
 * the rate on the right is the one the list sorts by, named there
 */
function BasicEarnPhoneLoansPreview({
  markets,
  isMarketsLoaded,
  onOpenPair,
  onOpenAll,
}: {
  markets: IEarnDesktopMarketReserves[];
  isMarketsLoaded: boolean;
  onOpenPair: (pair: IEarnDesktopLoanPair) => void;
  onOpenAll: () => void;
}) {
  const intl = useIntl();
  const { pairs, isStableListIn } = useEarnDesktopLoanPairs(markets);
  const preview = useMemo(
    () => pickLoanPreviewPairs(pairs, PREVIEW_COUNT),
    [pairs],
  );
  if (!isMarketsLoaded || !isStableListIn) {
    return <PreviewSkeleton />;
  }
  // No market answered with a pair: the section leaves rather than stays
  // empty
  if (!preview.length) {
    return null;
  }
  return (
    <YStack gap="$3">
      <EarnPhoneSectionTitle
        title={intl.formatMessage({ id: ETranslations.earn_loans__action })}
        testID="earn-phone-loans-title"
        onPress={onOpenAll}
        trailing={
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {EARN_DESKTOP_DEMO_COPY.loanNetApyHeader(
              `${EARN_DESKTOP_LOAN_LTV * 100}%`,
            )}
          </SizableText>
        }
      />
      <YStack gap={EARN_LIST_ROW_GAP}>
        {preview.map((pair) => (
          <EarnDesktopLoanPairRow
            key={pair.key}
            pair={pair}
            isWide={false}
            // The home's other sections' rows end in their figure
            hidesChevron
            onOpenPair={onOpenPair}
          />
        ))}
      </YStack>
    </YStack>
  );
}

export const EarnPhoneLoansPreview = memo(BasicEarnPhoneLoansPreview);
