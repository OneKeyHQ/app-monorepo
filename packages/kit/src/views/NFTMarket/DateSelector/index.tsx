import type { FC } from 'react';

import { Row } from 'native-base';
import { useIntl } from 'react-intl';

import { Box, Icon, Select, Text } from '@onekeyhq/components';

type Props = {
  title?: string;
  onChange: (date: number) => void;
};
const DateSelector: FC<Props> = ({ title, onChange }) => {
  const intl = useIntl();

  const options = [
    {
      title: intl.formatMessage({ id: 'content__hours' }),
      label: '6h',
      value: 0,
    },
    {
      title: intl.formatMessage({ id: 'content__hours' }),
      label: '12h',
      value: 1,
    },
    {
      title: intl.formatMessage({ id: 'content__day' }),
      label: '1d',
      value: 2,
    },
  ];

  return (
    <Box m="-8px">
      <Select
        title={intl.formatMessage({ id: 'content__duration' })}
        dropdownPosition="left"
        headerShown={false}
        options={options}
        isTriggerPlain
        footer={null}
        activatable={false}
        onChange={onChange}
        renderTrigger={({ isHovered, isPressed }) => (
          <Row
            alignItems="center"
            p="8px"
            bgColor={
              // eslint-disable-next-line no-nested-ternary
              isPressed
                ? 'surface-pressed'
                : isHovered
                ? 'surface-hovered'
                : 'transparent'
            }
            borderRadius="xl"
          >
            <Text color="text-subdued" typography="Body2Strong">
              {title}
            </Text>
            <Box ml="4px">
              <Icon size={20} name="ChevronDownMini" color="icon-subdued" />
            </Box>
          </Row>
        )}
      />
    </Box>
  );
};

export default DateSelector;
