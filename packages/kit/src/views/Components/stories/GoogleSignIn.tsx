import { Column } from 'native-base';

import { Button, Center } from '@onekeyhq/components';
import * as CloudFs from '@onekeyhq/shared/src/cloudfs';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

const GoogleSignInGallery = () => {
  const { serviceCloudBackup } = backgroundApiProxy;

  const checkSignedIn = async () => {
    try {
      const isSignedIn = await CloudFs.loginIfNeeded(false);
      console.log('isSignedIn = ', isSignedIn);
    } catch (error) {
      console.log('error = ', error);
    }
  };

  const signIn = async () => {
    try {
      const isSignedIn = await CloudFs.loginIfNeeded(true);
      console.log('isSignedIn = ', isSignedIn);
    } catch (error) {
      console.log('error = ', error);
    }
  };

  const logout = async () => {
    try {
      console.log('logout');

      const result = await CloudFs.logoutFromGoogleDrive();
      console.log('result = ', result);
    } catch (error) {
      console.log('error = ', error);
    }
  };

  return (
    <Center flex="1" bg="background-hovered">
      <Column space={50}>
        <Button
          size="lg"
          onPress={() => {
            checkSignedIn();
          }}
        >
          CheckSignedIn
        </Button>
        <Button
          size="lg"
          onPress={() => {
            signIn();
          }}
        >
          logInGoogleDrive
        </Button>

        <Button
          size="lg"
          onPress={() => {
            logout();
          }}
        >
          logout
        </Button>

        <Button
          size="lg"
          onPress={() => {
            // serviceCloudBackup.saveDataToCloud('123456acddd');
          }}
        >
          save
        </Button>

        <Button
          size="lg"
          onPress={() => {
            CloudFs.listFiles('onekey/').then((result) => {
              console.log('listFiles = ', result);
            });
          }}
        >
          listFile
        </Button>

        <Button
          size="lg"
          onPress={() => {
            CloudFs.deleteFile(
              'onekey/3c6f53e0-c797-4a5d-ba0a-dede2d5410f0.backup',
            );
          }}
        >
          deleteFile
        </Button>
      </Column>
    </Center>
  );
};

export default GoogleSignInGallery;
