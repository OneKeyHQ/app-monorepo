import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { HStack, Icon, Text } from '@onekeyhq/components';

import type { ReceiverError } from '../types';

const MAX_ERROR_DISPLAY = 3;

interface Props {
  errors: ReceiverError[];
}

function ReceiverErrors(props: Props) {
  const { errors } = props;
  const intl = useIntl();

  const errorsDisplayed = useMemo(() => {
    const result = [];
    const errorCount = errors.length;
    for (
      let i = 0, len = BigNumber.min(errorCount, MAX_ERROR_DISPLAY).toNumber();
      i < len;
      i += 1
    ) {
      const error = errors[i];
      result.push(
        <HStack space="10px" alignItems="center" key={error.lineNumber}>
          <Icon
            name="InformationCircleOutline"
            size={12}
            color="icon-warning"
          />
          <Text
            typography="Caption"
            key={error.lineNumber}
            color="text-warning"
            fontSize={12}
          >
            {intl.formatMessage(
              { id: 'form__line_str' },
              { 0: error.lineNumber },
            )}
            : {error.message}
          </Text>
        </HStack>,
      );
    }

    if (errorCount > MAX_ERROR_DISPLAY) {
      result.push(
        <HStack space="10px" alignItems="center">
          <Icon
            name="InformationCircleOutline"
            size={12}
            color="icon-warning"
          />
          <Text typography="Caption" fontSize={12} color="text-warning">
            {intl.formatMessage(
              { id: 'msg__other_str_lines_errors' },
              { count: errorCount - MAX_ERROR_DISPLAY },
            )}
          </Text>
        </HStack>,
      );
    }
    return result;
  }, [errors, intl]);

  return <>{errorsDisplayed}</>;
}

export { ReceiverErrors };
