import RNRestart from 'react-native-restart';

import { Button } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const RestartGallery = () => {
  return (
    <Layout
      getFilePath={() => __CURRENT_FILE_PATH__}
      componentName="SecureQRToast"
      elements={[
        {
          title: 'restartApp',
          element: (
            <Button
              onPress={() => {
                RNRestart.restart();
              }}
            >
              restart app
            </Button>
          ),
        },
      ]}
    />
  );
};

export default RestartGallery;
