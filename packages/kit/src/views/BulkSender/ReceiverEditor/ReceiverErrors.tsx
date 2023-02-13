import { useIntl } from 'react-intl';

import { HStack, Icon, Text } from '@onekeyhq/components';

import type { ReceiverError } from '../types';

interface Props {
  errors: ReceiverError[];
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
            : {error.message}
          </Text>
        </HStack>
      ))}
    </>
  );
}

export { ReceiverErrors };
