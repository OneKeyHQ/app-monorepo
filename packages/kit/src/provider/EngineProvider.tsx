import React, { FC, useEffect, useState } from 'react';

import * as SplashScreen from 'expo-splash-screen';

import { Box, Center, Spinner } from '@onekeyhq/components';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

const EngineApp: FC = ({ children }) => {
  const [loading, setLoading] = useState(true);

  const { serviceApp } = backgroundApiProxy;
  useEffect(() => {
    async function main() {
      try {
        await serviceApp.initApp();
      } catch (e) {
        console.log(e);
      } finally {
        setLoading(false);
        await SplashScreen.hideAsync();
      }
    }
    main();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box flex="1">
      {loading ? (
        <Center w="full" h="full">
          <Spinner />
        </Center>
      ) : (
        children
      )}
    </Box>
  );
};

export default EngineApp;
