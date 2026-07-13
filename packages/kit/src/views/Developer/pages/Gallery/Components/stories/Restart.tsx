import { Button } from '@onekeyhq/components';
import { appRestart } from '@onekeyhq/shared/src/modules3rdParty/appRestart';
import { EAppRestartMode } from '@onekeyhq/shared/src/modules3rdParty/appRestart/types';

import { Layout } from './utils/Layout';

const RestartGallery = () => {
  return (
    <Layout
      getFilePath={() => __CURRENT_FILE_PATH__}
      componentName="SecureQRToast"
      elements={[
        {
          title: 'restart (mode=ui)',
          element: (
            <Button
              onPress={() => {
                void appRestart({
                  mode: EAppRestartMode.UI,
                  reason: 'dev.gallery.ui',
                });
              }}
            >
              restart UI runtime
            </Button>
          ),
        },
        {
          title: 'restart (mode=all)',
          element: (
            <Button
              onPress={() => {
                void appRestart({
                  mode: EAppRestartMode.All,
                  reason: 'dev.gallery.all',
                });
              }}
            >
              restart all runtimes
            </Button>
          ),
        },
      ]}
    />
  );
};

export default RestartGallery;
