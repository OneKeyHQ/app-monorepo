import { errorsIntlFormatter } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import type { IntlShape, MessageDescriptor } from 'react-intl';

const intlRef: {
  current: IntlShape | undefined;
} = {
  current: undefined,
};
function formatMessage(
  descriptor: MessageDescriptor,
  values?: Record<string, any>,
): string | undefined {
  return intlRef?.current?.formatMessage(descriptor, values) || descriptor.id;
}

const appIntl = {
  intlRef,
  formatMessage,
};

errorsIntlFormatter.formatMessage = formatMessage;

export default appIntl;
