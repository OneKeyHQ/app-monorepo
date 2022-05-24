import { useEffect } from 'react';

import {
  ModalScreenProps,
  RootRoutes,
  RootRoutesParams,
} from '../routes/types';

import { useAppSelector } from './redux';
import useNavigation from './useNavigation';

type NavigationProps = ModalScreenProps<RootRoutesParams>;

export const useOnboardingFinished = () => {
  const navigation = useNavigation<NavigationProps['navigation']>();
  const boardingCompleted = useAppSelector((s) => s.status.boardingCompleted);
  useEffect(() => {
    if (!boardingCompleted) {
      navigation.replace(RootRoutes.Welcome);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
