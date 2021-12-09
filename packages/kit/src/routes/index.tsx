import { ICON_NAMES } from '@onekeyhq/components/src/Icon/Icons';

import ComponentsScreen from '../views/Components';
import WalletScreen from '../views/Wallet';
import SwapScreen from '../views/Swap';
import PortfolioScreen from '../views/Portfolio';
import DiscoverScreen from '../views/Discover';
import SettingsScreen from '../views/Settings';

import AddressGallery from '../views/Components/stories/Address';
import AvatarGallery from '../views/Components/stories/Avatar';
import TypographyGallery from '../views/Components/stories/Typography';
import TokenGallery from '../views/Components/stories/Token';
import ThemeGallery from '../views/Components/stories/Theme';
import IconGallery from '../views/Components/stories/Icon';
import Buttons from '../views/Components/stories/Buttons';

type TabRoute = {
  icon: ICON_NAMES;
  name: string;
  component: React.ComponentType<any>;
};

export const tabRoutes: TabRoute[] = [
  { name: 'Home', component: ComponentsScreen, icon: 'ChipOutline' },
  { name: 'Wallet', component: WalletScreen, icon: 'HomeOutline' },
  { name: 'Swap', component: SwapScreen, icon: 'SwitchHorizontalOutline' },
  { name: 'Portfolio', component: PortfolioScreen, icon: 'TrendingUpOutline' },
  { name: 'Discover', component: DiscoverScreen, icon: 'CompassOutline' },
  { name: 'Settings', component: SettingsScreen, icon: 'CogOutline' },
];

export const stackRoutes = [
  { name: 'Components/Address', component: AddressGallery },
  { name: 'Components/Avatar', component: AvatarGallery },
  { name: 'Components/Typography', component: TypographyGallery },
  { name: 'Components/Token', component: TokenGallery },
  { name: 'Components/Theme', component: ThemeGallery },
  { name: 'Components/Icon', component: IconGallery },
  { name: 'Components/Buttons', component: Buttons },
];
