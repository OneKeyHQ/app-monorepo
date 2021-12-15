import { ICON_NAMES } from '@onekeyhq/components/src/Icon/Icons';

// eslint-disable-next-line import/no-cycle
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
import BadgeGallery from '../views/Components/stories/Badge';
import AlertGallery from '../views/Components/stories/Alert';
import IconButtons from '../views/Components/stories/IconButtons';
import ButtonsGallery from '../views/Components/stories/Buttons';
import SelectGallery from '../views/Components/stories/Select';
import EmptyGallery from '../views/Components/stories/Empty';
import ToastGallery from '../views/Components/stories/Toast';
import AccountGallery from '../views/Components/stories/Account';
import CheckBoxGallery from '../views/Components/stories/CheckBox';
import SpinnerGallery from '../views/Components/stories/Spinner';
import ModalGallery from '../views/Components/stories/Modal';
import InputGallery from '../views/Components/stories/Input';
import SearchbarGallery from '../views/Components/stories/Searchbar';
import TextareaGallery from '../views/Components/stories/Textarea';

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
  { name: 'Components/Textarea', component: TextareaGallery },
  { name: 'Components/Searchbar', component: SearchbarGallery },
  { name: 'Components/Address', component: AddressGallery },
  { name: 'Components/Input', component: InputGallery },
  { name: 'Components/Avatar', component: AvatarGallery },
  { name: 'Components/Typography', component: TypographyGallery },
  { name: 'Components/Token', component: TokenGallery },
  { name: 'Components/Theme', component: ThemeGallery },
  { name: 'Components/Icon', component: IconGallery },
  { name: 'Components/Badge', component: BadgeGallery },
  { name: 'Components/Alert', component: AlertGallery },
  { name: 'Components/Buttons', component: ButtonsGallery },
  { name: 'Components/IconButtons', component: IconButtons },
  { name: 'Components/Select', component: SelectGallery },
  { name: 'Components/Empty', component: EmptyGallery },
  { name: 'Components/Toast', component: ToastGallery },
  { name: 'Components/Account', component: AccountGallery },
  { name: 'Components/CheckBox', component: CheckBoxGallery },
  { name: 'Components/Spinner', component: SpinnerGallery },
  { name: 'Components/Modal', component: ModalGallery },
];
