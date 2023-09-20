import { useState } from 'react';

import {
  Center,
  Radio,
  RadioButton,
  RadioButtonGroup,
  RadioGroup,
  ScrollView,
  Typography,
} from '@onekeyhq/components';

const RadioGallery = () => {
  const [radioValue, setValue] = useState('1');
  return (
    <ScrollView flex="1" bg="background-hovered">
      <Center>
        <Typography.Body1>Radio One</Typography.Body1>
        <RadioGroup
          w={320}
          defaultValue="1"
          name="group1"
          value={radioValue}
          onChange={(value) => {
            setValue(value);
          }}
        >
          <Radio
            isDisabled
            value="1"
            title="Comments"
            description="Get notified when someones posts a comment on a posting."
          />
          <Radio value="2" title="Comments" />
          <Radio
            value="3"
            title="Comments"
            description="Get notified when someones posts a comment on a posting."
          />
          <Radio
            value="4"
            title="Comments"
            description="Get notified when someones posts a comment on a posting.Get notified when someones posts a comment on a posting."
          />
        </RadioGroup>

        <Typography.Body1>Radio Two</Typography.Body1>
        <RadioGroup
          defaultValue="1"
          name="group1"
          value={radioValue}
          onChange={(value) => {
            setValue(value);
          }}
        >
          <Radio isDisabled value="1" />
          <Radio value="2" />
          <Radio value="3" />
        </RadioGroup>

        <Typography.Body1>Radio Three</Typography.Body1>
        <RadioGroup
          flexDirection="row"
          defaultValue="1"
          name="group1"
          value={radioValue}
          onChange={(value) => {
            setValue(value);
          }}
        >
          <Radio isDisabled value="1" />
          <Radio value="2" />
          <Radio value="3" />
        </RadioGroup>

        <Typography.Body1>Radio Button One</Typography.Body1>
        <RadioButtonGroup
          flexDirection="row"
          defaultValue="1"
          name="group1"
          size="xl"
          value={radioValue}
          onChange={(value) => {
            setValue(value);
          }}
        >
          <RadioButton isDisabled value="1" title="24h" />
          <RadioButton value="2" title="1w" />
          <RadioButton value="3" title="1m" />
        </RadioButtonGroup>

        <Typography.Body1>Radio Button Two</Typography.Body1>
        <RadioButtonGroup
          flexDirection="row"
          defaultValue="1"
          name="group1"
          size="base"
          value={radioValue}
          onChange={(value) => {
            setValue(value);
          }}
        >
          <RadioButton isDisabled value="1" title="24h" />
          <RadioButton value="2" title="1w" />
          <RadioButton value="3" title="1m" />
        </RadioButtonGroup>

        <Typography.Body1>Radio Button Three</Typography.Body1>
        <RadioButtonGroup
          flexDirection="column"
          defaultValue="1"
          name="group1"
          size="sm"
          value={radioValue}
          onChange={(value) => {
            setValue(value);
          }}
        >
          <RadioButton isDisabled value="1" title="24h" />
          <RadioButton value="2" title="1w" />
          <RadioButton value="3" title="1m" />
        </RadioButtonGroup>

        <Typography.Body1>Radio Button Four</Typography.Body1>
        <RadioButtonGroup
          flexDirection="row"
          defaultValue="1"
          name="group1"
          size="sm"
          isDisabled
          value={radioValue}
          onChange={(value) => {
            setValue(value);
          }}
        >
          <RadioButton isDisabled value="1" title="24h" />
          <RadioButton value="2" title="1w" />
          <RadioButton value="3" title="1m" />
        </RadioButtonGroup>
      </Center>
    </ScrollView>
  );
};

export default RadioGallery;
