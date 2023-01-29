import { useState } from 'react';

import {
  Box,
  Center,
  CheckBox,
  Divider,
  ScrollView,
} from '@onekeyhq/components';

const CheckboxWithChildren = () => {
  const [checked, setChecked] = useState(false);
  return (
    <CheckBox
      onChange={(isSelected) => setChecked(isSelected)}
      isChecked={checked}
      title="title"
    >
      children text
    </CheckBox>
  );
};

const Checkbox0 = () => {
  const [checked, setChecked] = useState(false);
  return (
    <CheckBox
      onChange={(isSelected) => setChecked(isSelected)}
      isChecked={checked}
      title="title"
    />
  );
};

const Checkbox1 = () => {
  const [checked, setChecked] = useState(false);
  return (
    <CheckBox
      onChange={(isSelected) => setChecked(isSelected)}
      isChecked={checked}
      title="Default"
      description="Get notified when someones posts a comment on a posting."
    />
  );
};

const Checkbox2 = () => {
  const [checked, setChecked] = useState(false);
  return (
    <CheckBox
      onChange={(isSelected) => setChecked(isSelected)}
      defaultIsChecked
      isChecked={checked}
      title="DefaultIsChecked"
      description="Get notified when someones posts a comment on a posting."
    />
  );
};

const Checkbox3 = () => {
  const [checked, setChecked] = useState(false);
  return (
    <CheckBox
      isDisabled
      onChange={(isSelected) => setChecked(isSelected)}
      isChecked={checked}
      title="Disable"
      description="Get notified when someones posts a comment on a posting."
    />
  );
};

const Checkbox3False = () => {
  const [checked, setChecked] = useState(true);
  return (
    <CheckBox
      isDisabled
      onChange={(isSelected) => setChecked(isSelected)}
      isChecked={checked}
      title="Disable"
      description="Get notified when someones posts a comment on a posting."
    />
  );
};

const Checkbox4 = () => {
  const [checked, setChecked] = useState(false);
  return (
    <CheckBox
      focusable
      onChange={(isSelected) => setChecked(isSelected)}
      isChecked={checked}
      title="Focusable Checkbox"
      description="Get notified when someones posts a comment on a posting."
    />
  );
};

const Checkbox5 = () => <CheckBox title="UnControl Checkbox" />;

const Checkbox6 = () => (
  <CheckBox title="UnControl Disabled Checkbox" isChecked isDisabled />
);

const Checkbox7 = () => (
  <CheckBox
    title="Default UnControl Disabled Checkbox"
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
      onChange={(isSelected) => setChecked(isSelected)}
      isChecked={checked}
      title="Checkbox A Newline A Newline A Newline A Newline"
      description="A Newline A Newline A Newline A Newline A Newline A Newline"
    />
  );
};

const CheckboxGroup1 = () => {
  const [groupValue, setGroupValue] = useState(['Phone', 'Email']);
  return (
    <Box>
      <CheckBox.Group
        defaultValue={groupValue}
        accessibilityLabel="choose multiple items"
        onChange={(values) => {
          setGroupValue(values || []);
        }}
        alignItems="flex-start"
      >
        <CheckBox value="Phone" my="1">
          Phone
        </CheckBox>
        <CheckBox value="Email" my="1">
          Email
        </CheckBox>
        <CheckBox value="Message" my="1">
          Message
        </CheckBox>
        <CheckBox value="Fax" my="1">
          Fax
        </CheckBox>
      </CheckBox.Group>
      <Box _text={{ color: 'text-default' }}>Selected: {groupValue}</Box>
    </Box>
  );
};

const CheckBoxGallery = () => (
  <Center flex="1" bg="background-hovered">
    <ScrollView width="100%" pr={50} pl={50}>
      <CheckboxWithChildren />
      <Divider my="2" />
      <Checkbox0 />
      <Divider my="2" />
      <Checkbox1 />
      <Divider my="2" />
      <Checkbox2 />
      <Divider my="2" />
      <Checkbox3 />
      <Divider my="2" />
      <Checkbox3False />
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
      <Divider my="2" />
      <CheckboxGroup1 />
    </ScrollView>
  </Center>
);

export default CheckBoxGallery;
