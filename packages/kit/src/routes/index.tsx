import { ICON_NAMES } from '@onekeyhq/components/src/Icon/Icons';

import ApprovalScreen from '../views/Approval';
// eslint-disable-next-line import/no-cycle
import ComponentsScreen from '../views/Components';
import AccountGallery from '../views/Components/stories/Account';
import AddressGallery from '../views/Components/stories/Address';
import AlertGallery from '../views/Components/stories/Alert';
import AvatarGallery from '../views/Components/stories/Avatar';
import BadgeGallery from '../views/Components/stories/Badge';
import ButtonsGallery from '../views/Components/stories/Buttons';
import CheckBoxGallery from '../views/Components/stories/CheckBox';
import DialogGallery from '../views/Components/stories/Dialog';
import EmptyGallery from '../views/Components/stories/Empty';
import FormGallery from '../views/Components/stories/Form';
import IconGallery from '../views/Components/stories/Icon';
import IconButtons from '../views/Components/stories/IconButtons';
import InputGallery from '../views/Components/stories/Input';
import MarkdownGallery from '../views/Components/stories/Markdown';
import ModalGallery from '../views/Components/stories/Modal';
import PageActionsGallery from '../views/Components/stories/PageActions';
import QRCodeGallery from '../views/Components/stories/QRCode';
import RadioGallery from '../views/Components/stories/Radio';
import SearchbarGallery from '../views/Components/stories/Searchbar';
import SelectGallery from '../views/Components/stories/Select';
import SpinnerGallery from '../views/Components/stories/Spinner';
import SwitchGallery from '../views/Components/stories/Switch';
import TextareaGallery from '../views/Components/stories/Textarea';
import ThemeGallery from '../views/Components/stories/Theme';
import ToastGallery from '../views/Components/stories/Toast';
import TokenGallery from '../views/Components/stories/Token';
import TypographyGallery from '../views/Components/stories/Typography';
import DiscoverScreen from '../views/Discover';
import PortfolioScreen from '../views/Portfolio';
import SettingsScreen from '../views/Settings';
import SwapScreen from '../views/Swap';
import WalletScreen from '../views/Wallet';

type TabRoute = {
  icon: ICON_NAMES;
  name: string;
  component: React.ComponentType<any>;
};

// Define Router names here for TypeScript checking
export type RootStackParamList = {
  Home?: undefined;
  Wallet?: undefined;
  Swap?: undefined;
  Portfolio?: undefined;
  Discover?: undefined;
  Settings?: undefined;
  Approval?: undefined;
  // demo
  PageProfileSample?: { userId: string };
  PageFeedSample?: { sort: 'latest' | 'top' };
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
  { name: 'Approval', component: ApprovalScreen },
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
  { name: 'Components/Radio', component: RadioGallery },
  { name: 'Components/Switch', component: SwitchGallery },
  { name: 'Components/Form', component: FormGallery },
  { name: 'Components/QRCode', component: QRCodeGallery },
  { name: 'Components/Markdown', component: MarkdownGallery },
  { name: 'Components/Dialog', component: DialogGallery },
  { name: 'Components/PageActions', component: PageActionsGallery },
];
