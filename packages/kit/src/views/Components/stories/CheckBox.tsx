import React, { useState } from 'react';

import { Center, CheckBox } from '@onekeyhq/components';

const CheckBoxGallery = () => {
  const [checked, setChecked] = useState(false);
  return (
    <Center flex="1" bg="background-hovered">
      <CheckBox
        onChange={() => {
          setChecked(!checked);
        }}
        isChecked={checked}
        value="sdfsdf"
        describe="sdfsdfsdfsdfsdfsdfsdfsdf"
      />
      <CheckBox
        onChange={() => {
          setChecked(!checked);
        }}
        defaultIsChecked
        isChecked={checked}
        value="sdfsdf"
        describe="sdfsdfsdfsdfsdfsdfsdfsdf"
      />
      <CheckBox
        isDisabled
        onChange={() => {
          setChecked(!checked);
        }}
        isChecked={checked}
        value="sdfsdf"
        describe="sdfsdfsdfsdfsdfsdfsdfsdf"
      />
      <CheckBox
        focusable
        onChange={() => {
          setChecked(!checked);
        }}
        isChecked={checked}
        value="sdfsdf"
        describe="sdfsdfsdfsdfsdfsdfsdfsdf"
      />
      <CheckBox
        defaultIsChecked
        isDisabled
        onChange={() => {
          setChecked(!checked);
        }}
        isChecked={checked}
        value="sdfsdf"
        describe="sdfsdfsdfsdfsdfsdfsdfsdf"
      />
    </Center>
  );
};

export default CheckBoxGallery;
