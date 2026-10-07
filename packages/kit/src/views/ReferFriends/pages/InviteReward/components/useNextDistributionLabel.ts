import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';

// Match the reward detail headers; keep the raw value if it is not a date.
export function useNextDistributionLabel(value: string | null | undefined) {
  const { format } = useFormatDate();
  if (!value) {
    return null;
  }
  const formatted = format(value, 'MMM d');
  return formatted === '-' ? value : formatted;
}
