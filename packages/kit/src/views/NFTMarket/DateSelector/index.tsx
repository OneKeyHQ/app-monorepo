import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Select,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';

type Props = {
  title?: string;
  onChange: (date: number) => void;
};
const DateSelector: FC<Props> = ({ title, onChange }) => {
  const intl = useIntl();
  const isSmallScreen = useIsVerticalLayout();

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
    <Box>
      <Select
        title={intl.formatMessage({ id: 'content__duration' })}
        dropdownPosition="left"
        dropdownProps={isSmallScreen ? {} : { minW: '240px' }}
        headerShown={false}
        options={options}
        isTriggerPlain
        footer={null}
        activatable={false}
        onChange={onChange}
        renderTrigger={() => (
          <Box position="absolute" right="0px" top="8px" flexDirection="row">
            <Text color="text-subdued" paddingX="2px">
              {title}
            </Text>
            <Icon size={20} name="ChevronDownSolid" />
          </Box>
        )}
      />
    </Box>
  );
};

export default DateSelector;
