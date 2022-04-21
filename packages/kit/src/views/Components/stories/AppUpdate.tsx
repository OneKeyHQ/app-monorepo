import React from 'react';

import { Center, Markdown, Modal } from '@onekeyhq/components';

// const Modal1 = () => {

//   return (
//     <Modal
//       height={480}
//       visible={visible}
//       onClose={() => setVisible(!visible)}
//       hidePrimaryAction
//       scrollViewProps={{ children: <Markdown>{md}</Markdown> }}
//     />
//   );
// };

const AppUpdateGallery = () => {
  const md = `
  # What’s new in OneKey 1.0.3

  ## 💎  Improvements

  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla porta leo urna blandit.

  - Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla porta leo urna blandit.
  - Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla porta leo urna blandit.

  ## 🐞  Fixes
  
  - Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla porta leo urna blandit.
  - Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla porta leo urna blandit.

  ---

  # What’s new in OneKey 1.0.2

  ## 💎  Improvements

  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla porta leo urna blandit.

  - Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla porta leo urna blandit.
  - Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla porta leo urna blandit.

  ## 🐞  Fixes

  - Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla porta leo urna blandit.
  - Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla porta leo urna blandit.
  `;

  return (
    <Center flex="1" bg="background-default">
      <Modal
        size="sm"
        headerShown={false}
        maxHeight={640}
        hidePrimaryAction
        scrollViewProps={{ children: <Markdown>{md}</Markdown> }}
      />
    </Center>
  );
};

export default AppUpdateGallery;
