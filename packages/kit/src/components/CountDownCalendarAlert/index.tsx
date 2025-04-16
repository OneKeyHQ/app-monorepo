import { useEffect, useMemo, useState } from 'react';

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

const TEMPLATE_PLACEHOLDER = '#00#';
function TimeItem({
  translationId,
  timeLeft,
}: {
  translationId: ETranslations;
  timeLeft: number;
}) {
  const intl = useIntl();
  const templates = useMemo(() => {
    intl
      .formatMessage(
        { id: translationId },
        {
          number: TEMPLATE_PLACEHOLDER,
        },
      )
      .split(TEMPLATE_PLACEHOLDER);
    return intl
      .formatMessage(
        { id: translationId },
        {
          number: TEMPLATE_PLACEHOLDER,
        },
      )
      .split(TEMPLATE_PLACEHOLDER);
  }, [intl, translationId]);

  return templates.map((item: string) => {
    if (item === '') {
      return (
        <Badge badgeType="info" key={item}>
          <Badge.Text size="$bodyMdMedium" color="$textInfo">
            {timeLeft}
          </Badge.Text>
        </Badge>
      );
    }
    return (
      <SizableText
        key={item}
        size="$bodyMdMedium"
        display="flex"
        ai="center"
        position="relative"
      >
        {item}
      </SizableText>
    );
  });
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
