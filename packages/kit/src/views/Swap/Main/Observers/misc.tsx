import { useEffect } from 'react';

import { useIsFocused } from '@react-navigation/native';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import { SwapRoutes } from '../../typings';

const WelcomeObserver = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  useEffect(() => {
    async function main() {
      const swapWelcomeShown =
        await backgroundApiProxy.serviceSwap.getSwapWelcomeShown();
      if (swapWelcomeShown || !isFocused) {
        return;
      }
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Swap,
        params: {
          screen: SwapRoutes.Welcome,
        },
      });
    }
    const timer = setTimeout(main, 1000);
    return () => clearTimeout(timer);
  }, [navigation, isFocused]);
  return null;
};

export const MiscOberver = () => <WelcomeObserver />;
