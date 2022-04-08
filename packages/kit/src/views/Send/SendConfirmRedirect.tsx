import { useEffect } from 'react';

import {
  NavigationProp,
  StackActions,
  useNavigation,
} from '@react-navigation/native';

import useDappParams from '../../hooks/useDappParams';

import { SendRoutes, SendRoutesParams } from './types';

type NavigationProps = NavigationProp<SendRoutesParams, SendRoutes.SendConfirm>;

function SendConfirmRedirect() {
  const navigation = useNavigation<NavigationProps>();
  // @ts-ignore
  const { sourceInfo, encodedTx } = useDappParams();
  useEffect(() => {
    navigation.dispatch(
      StackActions.replace(SendRoutes.SendConfirm, {
        sourceInfo,
        encodedTx,
      }),
    );
  }, [encodedTx, navigation, sourceInfo]);

  return null;
}

export { SendConfirmRedirect };
