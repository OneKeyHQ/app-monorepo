import { useIntl } from 'react-intl';

export function FeeSpeedLabel({ index }: { index: number | string }) {
  const intl = useIntl();
  const indexInt = parseInt(index as string, 10);
  let title = `🚕  ${intl.formatMessage({ id: 'form__market' })}`;
  if (indexInt === 0) {
    title = `🚴🏻️  ${intl.formatMessage({ id: 'form__low' })}`;
  }
  if (indexInt === 1) {
    title = `🚕  ${intl.formatMessage({ id: 'form__market' })}`;
  }
  if (indexInt === 2) {
    title = `🚅  ${intl.formatMessage({ id: 'form__aggressive' })}`;
  }
  return <>{title}</>;
}
