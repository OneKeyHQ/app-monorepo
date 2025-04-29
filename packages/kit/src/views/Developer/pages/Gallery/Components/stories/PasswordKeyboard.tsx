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
    filePath={__CURRENT_FILE_PATH__}
    componentName="PasswordKeyboard"
    elements={[
      {
        title: 'Uncontrolled',
        element: Demo,
      },
    ]}
  />
);

export default PasswordKeyboardGallery;
