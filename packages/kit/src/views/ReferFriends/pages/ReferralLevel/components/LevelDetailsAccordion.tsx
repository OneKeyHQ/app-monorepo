import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Accordion,
  Icon,
  Image,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import type { IInviteLevelItem } from '@onekeyhq/shared/src/referralCode/type';

import { getLevelCommissionRateItems } from '../getLevelOverview';
import { LEVEL_COPY } from '../levelCopy';

import { LevelListSection } from './LevelListSection';
import { CommissionRateCard } from './LevelListSection/CommissionRateCard';
import { getDisplayLabel } from './LevelListSection/LevelAccordionItem';

function LevelIcon({ level }: { level?: IInviteLevelItem }) {
  if (level?.icon) {
    return <Image w="$6" h="$6" src={level.icon} />;
  }
  return <SizableText size="$bodyLg">{level?.emoji ?? ''}</SizableText>;
}

// A collapsed row still tells the user what is inside through its summary.
function SummaryItem({
  value,
  icon,
  title,
  summary,
  isLast,
  children,
}: {
  value: string;
  icon: ReactNode;
  title: string;
  summary: string;
  isLast: boolean;
  children: ReactNode;
}) {
  const { md } = useMedia();
  return (
    <Accordion.Item value={value}>
      <Accordion.Trigger borderWidth={0} p={0}>
        {({ open }: { open: boolean }) => (
          <XStack
            flex={1}
            ai="center"
            gap="$3"
            py="$3"
            px="$4"
            borderColor="$borderSubdued"
            borderBottomWidth={isLast && !open ? 0 : 1}
            borderTopWidth={0}
            borderRightWidth={0}
            borderLeftWidth={0}
          >
            <Stack w="$6" h="$6" ai="center" jc="center">
              {icon}
            </Stack>
            <SizableText size="$headingSm" flex={md ? 1 : undefined}>
              {title}
            </SizableText>
            {md ? null : (
              <SizableText
                flex={1}
                size="$bodyMd"
                color="$textSubdued"
                textAlign="right"
                numberOfLines={1}
              >
                {summary}
              </SizableText>
            )}
            <Stack
              transition="quick"
              animateOnly={ANIMATE_ONLY_TRANSFORM}
              rotate={open ? '180deg' : '0deg'}
            >
              <Icon
                name="ChevronDownSmallOutline"
                color={open ? '$iconActive' : '$iconSubdued'}
                size="$5"
              />
            </Stack>
          </XStack>
        )}
      </Accordion.Trigger>
      <Accordion.HeightAnimator transition="quick">
        <Accordion.Content
          unstyled
          p="$4"
          borderBottomWidth={isLast ? 0 : 1}
          borderTopWidth={0}
          borderRightWidth={0}
          borderLeftWidth={0}
          borderBottomColor="$borderSubdued"
        >
          {children}
        </Accordion.Content>
      </Accordion.HeightAnimator>
    </Accordion.Item>
  );
}

export function LevelDetailsAccordion({
  currentLevel,
  levels,
}: {
  currentLevel: IInviteLevelItem;
  levels: IInviteLevelItem[];
}) {
  const intl = useIntl();
  const rateItems = useMemo(
    () =>
      getLevelCommissionRateItems(currentLevel.commissionRates).map(
        ({ subject, rate }) => ({
          subject,
          rate,
          label: getDisplayLabel(
            intl,
            rate.commissionRatesLabelKey || rate.labelKey,
            rate.commissionRatesLabel ?? rate.label ?? subject,
          ),
        }),
      ),
    [currentLevel.commissionRates, intl],
  );

  return (
    <Accordion
      type="multiple"
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$3"
      borderCurve="continuous"
      overflow="hidden"
    >
      <SummaryItem
        value="rates"
        icon={<LevelIcon level={currentLevel} />}
        title={LEVEL_COPY.commissionRates(currentLevel.label)}
        summary={rateItems.map((item) => item.label).join(' · ')}
        isLast={false}
      >
        <XStack gap="$3" $md={{ flexDirection: 'column', gap: '$2' }}>
          {rateItems.map(({ subject, rate, label }) => (
            <CommissionRateCard key={subject} label={label} rate={rate} />
          ))}
        </XStack>
      </SummaryItem>
      <SummaryItem
        value="levels"
        icon={<LevelIcon level={levels[0]} />}
        title={LEVEL_COPY.allLevels}
        summary={levels.map((level) => level.label).join(' · ')}
        isLast
      >
        <LevelListSection currentLevel={currentLevel.level} levels={levels} />
      </SummaryItem>
    </Accordion>
  );
}
