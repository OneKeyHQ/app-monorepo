import { useState } from 'react';

import { Center, Switch } from '@onekeyhq/components';

const SwitchGallery = () => {
  const [checked, setChecked] = useState(false);
  return (
    <Center flex="1" bg="background-hovered">
      <Switch
        onToggle={() => {
          setChecked(!checked);
        }}
        isChecked={checked}
        label="Label"
        labelType="after"
      />

      <Switch
        onToggle={() => {
          setChecked(!checked);
        }}
        size="lg"
        isChecked={checked}
        label="Label"
        labelType="before"
      />
      <Switch
        onToggle={() => {
          setChecked(!checked);
        }}
        isChecked={checked}
        label="Label"
        labelType="false"
      />
      <Switch
        onToggle={() => {
          setChecked(!checked);
        }}
        isChecked={checked}
        label="Label"
        labelType="after"
        isDisabled
      />
      <Switch
        onToggle={() => {
          setChecked(!checked);
        }}
        isChecked={checked}
        label="Label"
        defaultIsChecked
        labelType="after"
        isDisabled
      />
    </Center>
  );
};

export default SwitchGallery;
