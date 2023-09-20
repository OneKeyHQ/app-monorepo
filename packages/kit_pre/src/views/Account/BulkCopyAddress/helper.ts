import type { IDerivationOption } from '../../../components/NetworkAccountSelector/hooks/useDerivationPath';
import type { IntlShape } from 'react-intl';

export const formatDerivationLabel = (
  intl: IntlShape,
  label: IDerivationOption['label'],
) => {
  if (!label) return '';
  if (typeof label === 'string') return label;
  if (typeof label === 'object') return intl.formatMessage({ id: label.id });
};
