import { useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ISizableTextProps } from '@onekeyhq/components';
import { Alert, Badge, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';

export interface ICountDownCalendarAlertProps {
  effectiveTimeAt: number;
  description?: string;
  descriptionTextProps?: ISizableTextProps;
}

const calculateTimeLeft = (effectiveTimeAt: number) => {
  const now = Date.now();
  const difference = effectiveTimeAt - now;

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0 };
  }

  const days = Math.floor(difference / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
  );
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
  return { days, hours, minutes };
};

function TimeItem({
  translationId,
  timeLeft,
}: {
  translationId: ETranslations;
  timeLeft: number;
}) {
  const intl = useIntl();
  const unit = intl.formatMessage({ id: translationId });

  // Format timeLeft to always have two digits (e.g., 3 -> "03", 10 -> "10")
  const formattedTimeLeft = String(timeLeft).padStart(2, '0');

  return (
    <>
      <Badge badgeType="info">
        <Badge.Text size="$bodyMdMedium" color="$textInfo">
          {formattedTimeLeft}
        </Badge.Text>
      </Badge>
      <SizableText
        size="$bodyMdMedium"
        color="$text"
        display="flex"
        ai="center"
        position="relative"
      >
        {unit}
      </SizableText>
    </>
  );
}

export function CountDownCalendarAlert({
  effectiveTimeAt,
  description,
  descriptionTextProps,
}: ICountDownCalendarAlertProps) {
  const intl = useIntl();
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
  }>({
    days: 0,
    hours: 0,
    minutes: 0,
  });

  useEffect(() => {
    setTimeLeft(calculateTimeLeft(effectiveTimeAt));
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(effectiveTimeAt));
    }, 60_000); // Update every minute
    return () => clearInterval(timer);
  }, [effectiveTimeAt]);

  const shouldShowDays = timeLeft.days > 0;
  const shouldShowHours = timeLeft.days > 0 || timeLeft.hours > 0;

  return (
    <Alert fullBleed type="info" icon="Calendar3HistoryOutline">
      <XStack gap="$2" flex={1} ai="center">
        <SizableText size="$bodyMdMedium" {...descriptionTextProps}>
          {description ||
            intl.formatMessage({ id: ETranslations.earn_event_ends_in })}
        </SizableText>
        <XStack flex={1} ai="center" gap="$1.5">
          {shouldShowDays ? (
            <TimeItem
              translationId={ETranslations.earn_day_abbr}
              timeLeft={timeLeft.days}
            />
          ) : null}
          {shouldShowHours ? (
            <TimeItem
              translationId={ETranslations.earn_hour_abbr}
              timeLeft={timeLeft.hours}
            />
          ) : null}
          <TimeItem
            translationId={ETranslations.earn_minute_abbr}
            timeLeft={timeLeft.minutes}
          />
        </XStack>
      </XStack>
    </Alert>
  );
}
