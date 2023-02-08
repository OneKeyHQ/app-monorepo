import { useIntl } from 'react-intl';

import { HStack, Icon, Text } from '@onekeyhq/components';

import { ReceiverErrorEnum } from '../types';

import type { ReceiverError } from '../types';

interface Props {
  errors: ReceiverError[];
}

function getErrorMessageId(errorType: ReceiverErrorEnum) {
  if (errorType === ReceiverErrorEnum.IcorrectAddress)
    return 'form__incorrect_address_format';
  if (errorType === ReceiverErrorEnum.IcorrectFormat)
    return 'form__modify_the_line_with_the_correct_format';
}

function ReceiverErrors(props: Props) {
  const { errors } = props;
  const intl = useIntl();

  return (
    <>
      {errors.map((error) => (
        <HStack space="10px" alignItems="center">
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
            : {intl.formatMessage({ id: getErrorMessageId(error.type) })}
          </Text>
        </HStack>
      ))}
    </>
  );
}

export { ReceiverErrors };
