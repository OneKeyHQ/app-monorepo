import { useState } from 'react';

import {
  Box,
  Center,
  RadioBox,
  RadioFee,
  ScrollView,
  Typography,
} from '@onekeyhq/components';

const RadioBoxGallery = () => {
  const [radioValue, setValue] = useState('1');
  return (
    <ScrollView flex="1" bg="background-hovered">
      <Center>
        <Typography.Body1>Radio Box One</Typography.Body1>
        <RadioBox.Group
          defaultValue="1"
          name="group1"
          value={radioValue}
          onChange={(value) => {
            setValue(value);
          }}
        >
          <RadioBox isDisabled value="1">
            <Typography.Body1>1</Typography.Body1>
          </RadioBox>
          <RadioBox
            value="2"
            flexDirection="row"
            justifyContent="space-between"
          >
            <Box>
              <Typography.Body1>2</Typography.Body1>
            </Box>
            <Box>
              <Typography.Body1>2</Typography.Body1>
            </Box>
          </RadioBox>
          <RadioBox value="3">
            <Typography.Body1>3</Typography.Body1>
          </RadioBox>
          <RadioBox value="4" />
        </RadioBox.Group>

        <Typography.Body1>Radio Box Two</Typography.Body1>
        <RadioFee
          items={[
            {
              value: '1',
              title: 'Fast',
              describe: '64.61 GWEI',
              isDisabled: true,
            },
            {
              value: '2',
              title: 'Normal',
              describe: '64.61 GWEI',
            },
            {
              value: '3',
              title: 'Slow',
              describe: '64.61 GWEI',
            },
          ]}
          defaultValue="1"
          name="group1"
          value={radioValue}
          onChange={(value) => {
            setValue(value);
          }}
        />

        <Typography.Body1>Radio Box Three</Typography.Body1>
        <RadioBox.Group
          defaultValue="1"
          name="group1"
          value={radioValue}
          onChange={(value) => {
            setValue(value);
          }}
          flexDirection="row"
          radioProps={{
            flex: 1,
            m: 1,
          }}
        >
          <RadioBox isDisabled value="1">
            <Typography.Body1>1</Typography.Body1>
          </RadioBox>
          <RadioBox
            value="2"
            flexDirection="row"
            justifyContent="space-between"
          >
            <Typography.Body1>2</Typography.Body1>
          </RadioBox>
          <RadioBox value="3">
            <Typography.Body1>3</Typography.Body1>
          </RadioBox>
          <RadioBox value="4">
            <Typography.Body1>4</Typography.Body1>
          </RadioBox>
        </RadioBox.Group>
      </Center>
    </ScrollView>
  );
};

export default RadioBoxGallery;
