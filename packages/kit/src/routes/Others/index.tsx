import SplashScreen from '../../views/Splash';
import UnlockScreen from '../../views/Unlock';
import WelcomeScreen from '../../views/Welcome';

import { OthersRoutes } from './enum';

export const OthersRoutesScreen = [
  { name: OthersRoutes.Unlock, component: UnlockScreen },
  { name: OthersRoutes.Splash, component: SplashScreen },
  { name: OthersRoutes.Welcome, component: WelcomeScreen },
];
