import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { HStack, Icon, Text } from '@onekeyhq/components';

import type { TraderError } from '../types';

const MAX_ERROR_DISPLAY = 3;

interface Props {
  traderErrors: TraderError[];
  showFileError: boolean;
}

function TraderErrors(props: Props) {
  const { traderErrors, showFileError } = props;
  const intl = useIntl();

  const receiverErrorsDisplayed = useMemo(() => {
    const result = [];
    const errorCount = traderErrors.length;
    for (
      let i = 0, len = BigNumber.min(errorCount, MAX_ERROR_DISPLAY).toNumber();
      i < len;
      i += 1
    ) {
      const error = traderErrors[i];
      result.push(
        <HStack space="10px" alignItems="center" key={i}>
          <Icon
            name="InformationCircleOutline"
            size={12}
            color="icon-warning"
          />
          <Text typography="Caption" color="text-warning" fontSize={12}>
            {error.lineNumber
              ? `${intl.formatMessage(
                  { id: 'form__line_str' },
                  { 0: error.lineNumber },
                )}: ${error.message}`
              : error.message}
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
  }, [traderErrors, intl]);

  return (
    <>
      {showFileError && (
        <HStack space="10px" alignItems="center">
          <Icon
            name="InformationCircleOutline"
            size={12}
            color="icon-warning"
          />
          <Text typography="Caption" color="text-warning" fontSize={12}>
            {intl.formatMessage({
              'id': 'msg__the_content_format_of_the_upload_file_is_incorrect',
            })}
          </Text>
        </HStack>
      )}
      {receiverErrorsDisplayed}
    </>
  );
}

export { TraderErrors };
