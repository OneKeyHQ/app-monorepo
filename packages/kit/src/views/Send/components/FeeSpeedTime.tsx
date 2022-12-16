import { useIntl } from 'react-intl';

export function FeeSpeedTime({
  index,
  waitingSeconds,
}: {
  index: number | string;
  waitingSeconds: number | undefined;
}) {
  const intl = useIntl();
  const indexInt = parseInt(index as string, 10);
  let title = intl.formatMessage({ id: 'content__likely_less_than_15s' });

  if (waitingSeconds) {
    title = intl.formatMessage(
      { id: 'content__about_int_str' },
      {
        time:
          waitingSeconds > 60 ? Math.ceil(waitingSeconds / 60) : waitingSeconds,
        unit: intl.formatMessage({
          id:
            waitingSeconds > 60
              ? 'content__minutes_lowercase'
              : 'content__seconds__lowercase',
        }),
      },
    );
  } else {
    if (indexInt === 0) {
      title = intl.formatMessage({ id: 'content__maybe_in_30s' });
    }
    if (indexInt === 1) {
      title = intl.formatMessage({ id: 'content__likely_less_than_15s' });
    }
    if (indexInt === 2) {
      title = intl.formatMessage({ id: 'content__very_likely_less_than_15s' });
    }
  }
  return <>{title}</>;
}
