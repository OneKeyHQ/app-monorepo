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

const Checkbox6 = () => (
  <CheckBox value="UnControl Disabled Checkbox" isChecked isDisabled />
);

const Checkbox7 = () => (
  <CheckBox
    value="Default UnControl Disabled Checkbox"
    isChecked
    defaultIsChecked
    isDisabled
  />
);

const Checkbox8 = () => {
  const [checked, setChecked] = useState(false);
  return (
    <CheckBox
      w={310}
      onChange={() => {
        setChecked(!checked);
      }}
      isChecked={checked}
      value="Checkbox A Newline A Newline A Newline A Newline"
      describe="A Newline A Newline A Newline A Newline A Newline A Newline"
    />
  );
};

const CheckBoxGallery = () => (
  <Center flex="1" bg="background-hovered">
    <Box width="100%" pr={50} pl={50}>
      <Checkbox1 />
      <Divider my="2" />
      <Checkbox2 />
      <Divider my="2" />
      <Checkbox3 />
      <Divider my="2" />
      <Checkbox4 />
      <Divider my="2" />
      <Checkbox5 />
      <Divider my="2" />
      <Checkbox6 />
      <Divider my="2" />
      <Checkbox7 />
      <Divider my="2" />
      <Checkbox8 />
    </Box>
  </Center>
);

export default CheckBoxGallery;
