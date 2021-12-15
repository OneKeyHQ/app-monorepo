import React, { useState } from 'react';

import { Center, CheckBox, Divider, Box } from '@onekeyhq/components';

const Checkbox1 = () => {
  const [checked, setChecked] = useState(false);
  return (
    <CheckBox
      onChange={() => {
        setChecked(!checked);
      }}
      isChecked={checked}
      value="Default"
      describe="Get notified when someones posts a comment on a posting."
    />
  );
};

const Checkbox2 = () => {
  const [checked, setChecked] = useState(false);
  return (
    <CheckBox
      onChange={() => {
        setChecked(!checked);
      }}
      defaultIsChecked
      isChecked={checked}
      value="DefaultIsChecked"
      describe="Get notified when someones posts a comment on a posting."
    />
  );
};

const Checkbox3 = () => {
  const [checked, setChecked] = useState(false);
  return (
    <CheckBox
      isDisabled
      onChange={() => {
        setChecked(!checked);
      }}
      isChecked={checked}
      value="Disable"
      describe="Get notified when someones posts a comment on a posting."
    />
  );
};

const Checkbox4 = () => {
  const [checked, setChecked] = useState(false);
  return (
    <CheckBox
      focusable
      onChange={() => {
        setChecked(!checked);
      }}
      isChecked={checked}
      value="Focusable Checkbox"
      describe="Get notified when someones posts a comment on a posting."
    />
  );
};

const Checkbox5 = () => <CheckBox value="UnControl Checkbox" />;

const CheckBoxGallery = () => (
  <Center flex="1" bg="background-hovered">
    <Box width="480px">
      <Checkbox1 />
      <Divider my="2" />
      <Checkbox2 />
      <Divider my="2" />
      <Checkbox3 />
      <Divider my="2" />
      <Checkbox4 />
      <Divider my="2" />
      <Checkbox5 />
    </Box>
  </Center>
);

export default CheckBoxGallery;
