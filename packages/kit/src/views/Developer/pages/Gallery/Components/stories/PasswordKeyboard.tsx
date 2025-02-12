import { useState } from 'react';

import { PasswordKeyboard } from '@onekeyhq/kit/src/views/LiteCard/components/PasswordKeyboard';

import { Layout } from './utils/Layout';

const Demo = () => {
  const [value, setValue] = useState('');
  return (
    <PasswordKeyboard
      value={value}
      onChange={(v) => {
        setValue(v);
        console.log(v);
      }}
    />
  );
};

const PasswordKeyboardGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Uncontrolled',
        element: Demo,
      },
    ]}
  />
);

export default PasswordKeyboardGallery;
