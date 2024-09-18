/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react/no-unstable-nested-components */
import { useState } from 'react';

import { PasswordKeyboard } from '@onekeyhq/kit/src/views/LiteCard/components/PasswordKeyboard';

import { Layout } from './utils/Layout';

const PasswordKeyboardGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Uncontrolled',
        element: () => {
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
        },
      },
    ]}
  />
);

export default PasswordKeyboardGallery;
