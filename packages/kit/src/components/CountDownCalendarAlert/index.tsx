import { useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Badge, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';

export interface ICountDownCalendarAlertProps {
  effectiveTimeAt: number;
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
  return (
    <SizableText size="$bodyMdMedium" display="flex" ai="center">
      {intl.formatMessage(
        { id: translationId },
        {
          number: (
            <Badge badgeType="info">
              <Badge.Text size="$bodyMdMedium" color="$textInfo">
                {timeLeft}
              </Badge.Text>
            </Badge>
          ),
        },
      )}
    </SizableText>
  );
}

export function CountDownCalendarAlert({
  effectiveTimeAt,
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
    const timer = setInterval(calculateTimeLeft, 60_000); // Update every minute
    return () => clearInterval(timer);
  }, [effectiveTimeAt]);
  return (
    <Alert fullBleed type="info" icon="Calendar3HistoryOutline">
      <XStack gap="$2" flex={1} ai="center">
        <SizableText size="$bodyMdMedium">
          {intl.formatMessage({ id: ETranslations.earn_event_ends_in })}
        </SizableText>
        <XStack flex={1} ai="center" gap="$1.5">
          <TimeItem
            translationId={ETranslations.earn_number_days}
            timeLeft={timeLeft.days}
          />
          <TimeItem
            translationId={ETranslations.earn_number_hours}
            timeLeft={timeLeft.hours}
          />
          <TimeItem
            translationId={ETranslations.earn_number_minutes}
            timeLeft={timeLeft.minutes}
          />
        </XStack>
      </XStack>
    </Alert>
  );
}
