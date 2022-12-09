import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useThemeValue } from '@onekeyhq/components';
import ComponentsScreen from '@onekeyhq/kit/src/views/Components';
import AccountGallery from '@onekeyhq/kit/src/views/Components/stories/Account';
import AccountSelectorGallery from '@onekeyhq/kit/src/views/Components/stories/AccountSelector/index';
import AddressGallery from '@onekeyhq/kit/src/views/Components/stories/Address';
import AlertGallery from '@onekeyhq/kit/src/views/Components/stories/Alert';
import AppUpdateGallery from '@onekeyhq/kit/src/views/Components/stories/AppUpdate';
import AvatarGallery from '@onekeyhq/kit/src/views/Components/stories/Avatar';
import BadgeGallery from '@onekeyhq/kit/src/views/Components/stories/Badge';
import BottomSheetModalGallery from '@onekeyhq/kit/src/views/Components/stories/BottomSheetModal';
import ButtonsGallery from '@onekeyhq/kit/src/views/Components/stories/Buttons';
import CheckBoxGallery from '@onekeyhq/kit/src/views/Components/stories/CheckBox';
import CollapseGallery from '@onekeyhq/kit/src/views/Components/stories/Collapse';
import ContainerGallery from '@onekeyhq/kit/src/views/Components/stories/Container';
import DialogGallery from '@onekeyhq/kit/src/views/Components/stories/Dialog';
import EmojiGallery from '@onekeyhq/kit/src/views/Components/stories/Emoji';
import EmptyGallery from '@onekeyhq/kit/src/views/Components/stories/Empty';
import FormGallery from '@onekeyhq/kit/src/views/Components/stories/Form';
import HardwareHomescreen from '@onekeyhq/kit/src/views/Components/stories/HardwareHomescreen';
import IconGallery from '@onekeyhq/kit/src/views/Components/stories/Icon';
import IconButtons from '@onekeyhq/kit/src/views/Components/stories/IconButtons';
import ImageViewerGallery from '@onekeyhq/kit/src/views/Components/stories/ImageViewer';
import InputGallery from '@onekeyhq/kit/src/views/Components/stories/Input';
import KeyboardGallery from '@onekeyhq/kit/src/views/Components/stories/Keyboard';
import ListGallery from '@onekeyhq/kit/src/views/Components/stories/List';
import LoggerGallery from '@onekeyhq/kit/src/views/Components/stories/Logger';
import MarkdownGallery from '@onekeyhq/kit/src/views/Components/stories/Markdown';
import MenuGallery from '@onekeyhq/kit/src/views/Components/stories/Menu';
import ModalGallery from '@onekeyhq/kit/src/views/Components/stories/Modal';
import NftCardGallery from '@onekeyhq/kit/src/views/Components/stories/NftCard';
import NFTImageGallery from '@onekeyhq/kit/src/views/Components/stories/NFTImage';
import PageActionsGallery from '@onekeyhq/kit/src/views/Components/stories/PageActions';
import PinCodeGallery from '@onekeyhq/kit/src/views/Components/stories/PinCode';
import PopoverGallery from '@onekeyhq/kit/src/views/Components/stories/Popover';
import QRCodeGallery from '@onekeyhq/kit/src/views/Components/stories/QRCode';
import RadioGallery from '@onekeyhq/kit/src/views/Components/stories/Radio';
import RadioBoxGallery from '@onekeyhq/kit/src/views/Components/stories/RadioBox';
import RestfulRequest from '@onekeyhq/kit/src/views/Components/stories/RestfulRequest';
import SearchbarGallery from '@onekeyhq/kit/src/views/Components/stories/Searchbar';
import SegmentedControl from '@onekeyhq/kit/src/views/Components/stories/SegmentedControl';
import SelectGallery from '@onekeyhq/kit/src/views/Components/stories/Select';
import ShadowsGallery from '@onekeyhq/kit/src/views/Components/stories/Shadows';
import SkeletonGallery from '@onekeyhq/kit/src/views/Components/stories/Skeleton';
import SortableListGallery from '@onekeyhq/kit/src/views/Components/stories/SortableList';
import SpinnerGallery from '@onekeyhq/kit/src/views/Components/stories/Spinner';
import SwitchGallery from '@onekeyhq/kit/src/views/Components/stories/Switch';
import TabsGallery from '@onekeyhq/kit/src/views/Components/stories/Tabs';
import TextareaGallery from '@onekeyhq/kit/src/views/Components/stories/Textarea';
import ThemeGallery from '@onekeyhq/kit/src/views/Components/stories/Theme';
import ToastGallery from '@onekeyhq/kit/src/views/Components/stories/Toast';
import ToggleButtonGroupGallery from '@onekeyhq/kit/src/views/Components/stories/ToggleButtonGroup';
import TypeWriter from '@onekeyhq/kit/src/views/Components/stories/TypeWriter';
import TypographyGallery from '@onekeyhq/kit/src/views/Components/stories/Typography';
import WalletSelectorGallery from '@onekeyhq/kit/src/views/Components/stories/WalletSelector/index';
import WebViewGallery from '@onekeyhq/kit/src/views/Components/stories/WebView';

import NavHeaderGallery from '../../views/Components/stories/NavHeader';
import PriceChart from '../../views/Components/stories/PriceChart';
import renderCustomSubStackHeader from '../Stack/Header';

export enum StackRoutes {
  Developer = 'developer',
  ComponentApproval = 'component/approval',
  ComponentSearchBar = 'component/searchBar',
  ComponentTextarea = 'component/textarea',
  ComponentAddress = 'component/address',
  ComponentInput = 'component/input',
  ComponentCard = 'component/card',
  ComponentAvatar = 'component/avatar',
  ComponentTypography = 'component/typography',
  ComponentNFTImage = 'component/nftimage',
  ComponentToken = 'component/token',
  ComponentTheme = 'component/theme',
  ComponentIcon = 'component/icon',
  ComponentBadge = 'component/badge',
  ComponentMenu = 'component/menu',
  ComponentList = 'component/List',
  ComponentAlert = 'component/alert',
  ComponentButton = 'component/button',
  ComponentIconButton = 'component/icon-button',
  ComponentSelect = 'component/select',
  ComponentShadow = 'component/shadow',
  ComponentEmpty = 'component/empty',
  ComponentToast = 'component/toast',
  ComponentAccount = 'component/account',
  ComponentWalletSelector = 'component/walletSelector',
  ComponentAccountSelector = 'component/accountSelector',
  ComponentCheckbox = 'component/checkbox',
  ComponentSpinner = 'component/spinner',
  ComponentModal = 'component/modal',
  ComponentRadio = 'component/radio',
  ComponentRadioBox = 'component/radio-box',
  ComponentSwitch = 'component/switch',
  ComponentForm = 'component/form',
  ComponentQRCode = 'component/qrcode',
  ComponentMarkdown = 'component/markdown',
  ComponentDialog = 'component/dialog',
  ComponentDappModals = 'component/dappModals',
  ComponentPageActions = 'component/page-actions',
  ComponentSortableList = 'component/sortable-list',
  ComponentTabs = 'component/tabs',
  ComponentSegmentedControl = 'component/segmented-control',
  ComponentReduxMessage = 'component/redux-message',
  ComponentLogger = 'component/logger',
  ComponentFirebase = 'component/firebase',
  ComponentWebview = 'component/webview',
  ComponentPinCode = 'component/pincode',
  ComponentRestfulRequest = 'component/restful-request',
  ComponentImageViewer = 'component/imageViewer',
  ComponentEmojiList = 'component/EmojiList',
  ComponentKeyboard = 'component/Keyboard',
  ComponentContentBox = 'component/ContentBox',
  ComponentAppUpdate = 'component/AppUpdate',
  ComponentSkeleton = 'component/Skeleton',
  ComponentPopover = 'component/Popover',
  ComponentPriceChart = 'component/PriceChart',
  ComponentTypeWriter = 'component/TypeWriter',
  ComponentHomescreen = 'component/homescreen',
  ComponentToggleButtonGroup = 'component/ToggleButtonGroup',
  ComponentCollapse = 'component/Collapse',
  ComponentBottomSheetModal = 'component/BottomSheetModal',
  ComponentNavHeaderGallery = 'component/NavHeader',
}

export type StackBasicRoutesParams = {
  [StackRoutes.Developer]: { ts: number };
  [StackRoutes.ComponentApproval]: undefined;
  [StackRoutes.ComponentSearchBar]: undefined;
  [StackRoutes.ComponentTextarea]: undefined;
  [StackRoutes.ComponentAddress]: undefined;
  [StackRoutes.ComponentInput]: undefined;
  [StackRoutes.ComponentCard]: undefined;
  [StackRoutes.ComponentDappModals]: undefined;
  [StackRoutes.ComponentAvatar]: undefined;
  [StackRoutes.ComponentTypography]: undefined;
  [StackRoutes.ComponentToken]: undefined;
  [StackRoutes.ComponentTheme]: undefined;
  [StackRoutes.ComponentIcon]: undefined;
  [StackRoutes.ComponentBadge]: undefined;
  [StackRoutes.ComponentMenu]: undefined;
  [StackRoutes.ComponentAlert]: undefined;
  [StackRoutes.ComponentButton]: undefined;
  [StackRoutes.ComponentIconButton]: undefined;
  [StackRoutes.ComponentSelect]: undefined;
  [StackRoutes.ComponentShadow]: undefined;
  [StackRoutes.ComponentEmpty]: undefined;
  [StackRoutes.ComponentToast]: undefined;
  [StackRoutes.ComponentAccount]: undefined;
  [StackRoutes.ComponentWalletSelector]: undefined;
  [StackRoutes.ComponentAccountSelector]: undefined;
  [StackRoutes.ComponentCheckbox]: undefined;
  [StackRoutes.ComponentSpinner]: undefined;
  [StackRoutes.ComponentModal]: undefined;
  [StackRoutes.ComponentRadio]: undefined;
  [StackRoutes.ComponentRadioBox]: undefined;
  [StackRoutes.ComponentSwitch]: undefined;
  [StackRoutes.ComponentForm]: undefined;
  [StackRoutes.ComponentQRCode]: undefined;
  [StackRoutes.ComponentMarkdown]: undefined;
  [StackRoutes.ComponentDialog]: undefined;
  [StackRoutes.ComponentPageActions]: undefined;
  [StackRoutes.ComponentSortableList]: undefined;
  [StackRoutes.ComponentTabs]: undefined;
  [StackRoutes.ComponentSegmentedControl]: undefined;
  [StackRoutes.ComponentReduxMessage]: undefined;
  [StackRoutes.ComponentLogger]: undefined;
  [StackRoutes.ComponentFirebase]: undefined;
  [StackRoutes.ComponentWebview]: undefined;
  [StackRoutes.ComponentPinCode]: undefined;
  [StackRoutes.ComponentRestfulRequest]: undefined;
  [StackRoutes.ComponentImageViewer]: undefined;
  [StackRoutes.ComponentEmojiList]: undefined;
  [StackRoutes.ComponentContentBox]: undefined;
  [StackRoutes.ComponentAppUpdate]: undefined;
  [StackRoutes.ComponentSkeleton]: undefined;
  [StackRoutes.ComponentKeyboard]: undefined;
  [StackRoutes.ComponentPopover]: undefined;
  [StackRoutes.ComponentPriceChart]: undefined;
  [StackRoutes.ComponentTypeWriter]: undefined;
  [StackRoutes.ComponentHomescreen]: undefined;
  [StackRoutes.ComponentNFTImage]: undefined;
  [StackRoutes.ComponentList]: undefined;
  [StackRoutes.ComponentToggleButtonGroup]: undefined;
  [StackRoutes.ComponentCollapse]: undefined;
  [StackRoutes.ComponentBottomSheetModal]: undefined;
  [StackRoutes.ComponentNavHeaderGallery]: undefined;
};

export const stackScreenList = [
  { name: StackRoutes.Developer, component: ComponentsScreen },
  { name: StackRoutes.ComponentTextarea, component: TextareaGallery },
  { name: StackRoutes.ComponentSearchBar, component: SearchbarGallery },
  { name: StackRoutes.ComponentAddress, component: AddressGallery },
  { name: StackRoutes.ComponentInput, component: InputGallery },
  { name: StackRoutes.ComponentCard, component: NftCardGallery },
  { name: StackRoutes.ComponentAvatar, component: AvatarGallery },
  { name: StackRoutes.ComponentTypography, component: TypographyGallery },
  { name: StackRoutes.ComponentNFTImage, component: NFTImageGallery },
  { name: StackRoutes.ComponentTheme, component: ThemeGallery },
  { name: StackRoutes.ComponentIcon, component: IconGallery },
  { name: StackRoutes.ComponentBadge, component: BadgeGallery },
  { name: StackRoutes.ComponentMenu, component: MenuGallery },
  { name: StackRoutes.ComponentList, component: ListGallery },
  { name: StackRoutes.ComponentAlert, component: AlertGallery },
  { name: StackRoutes.ComponentButton, component: ButtonsGallery },
  { name: StackRoutes.ComponentIconButton, component: IconButtons },
  { name: StackRoutes.ComponentSelect, component: SelectGallery },
  { name: StackRoutes.ComponentEmpty, component: EmptyGallery },
  { name: StackRoutes.ComponentToast, component: ToastGallery },
  { name: StackRoutes.ComponentAccount, component: AccountGallery },
  {
    name: StackRoutes.ComponentWalletSelector,
    component: WalletSelectorGallery,
  },
  {
    name: StackRoutes.ComponentAccountSelector,
    component: AccountSelectorGallery,
  },
  { name: StackRoutes.ComponentCheckbox, component: CheckBoxGallery },
  { name: StackRoutes.ComponentSpinner, component: SpinnerGallery },
  { name: StackRoutes.ComponentModal, component: ModalGallery },
  { name: StackRoutes.ComponentRadio, component: RadioGallery },
  { name: StackRoutes.ComponentRadioBox, component: RadioBoxGallery },
  { name: StackRoutes.ComponentSwitch, component: SwitchGallery },
  { name: StackRoutes.ComponentForm, component: FormGallery },
  { name: StackRoutes.ComponentQRCode, component: QRCodeGallery },
  { name: StackRoutes.ComponentMarkdown, component: MarkdownGallery },
  { name: StackRoutes.ComponentDialog, component: DialogGallery },
  { name: StackRoutes.ComponentPageActions, component: PageActionsGallery },
  { name: StackRoutes.ComponentSortableList, component: SortableListGallery },
  { name: StackRoutes.ComponentTabs, component: TabsGallery },
  { name: StackRoutes.ComponentSegmentedControl, component: SegmentedControl },
  { name: StackRoutes.ComponentShadow, component: ShadowsGallery },
  { name: StackRoutes.ComponentPinCode, component: PinCodeGallery },
  { name: StackRoutes.ComponentAppUpdate, component: AppUpdateGallery },
  { name: StackRoutes.ComponentSkeleton, component: SkeletonGallery },
  { name: StackRoutes.ComponentRestfulRequest, component: RestfulRequest },
  {
    name: StackRoutes.ComponentLogger,
    component: LoggerGallery,
  },
  {
    name: StackRoutes.ComponentWebview,
    component: WebViewGallery,
  },
  {
    name: StackRoutes.ComponentImageViewer,
    component: ImageViewerGallery,
  },
  {
    name: StackRoutes.ComponentEmojiList,
    component: EmojiGallery,
  },
  {
    name: StackRoutes.ComponentContentBox,
    component: ContainerGallery,
  },
  {
    name: StackRoutes.ComponentKeyboard,
    component: KeyboardGallery,
  },
  {
    name: StackRoutes.ComponentPopover,
    component: PopoverGallery,
  },
  { name: StackRoutes.ComponentPriceChart, component: PriceChart },
  { name: StackRoutes.ComponentTypeWriter, component: TypeWriter },
  { name: StackRoutes.ComponentHomescreen, component: HardwareHomescreen },
  {
    name: StackRoutes.ComponentToggleButtonGroup,
    component: ToggleButtonGroupGallery,
  },
  {
    name: StackRoutes.ComponentCollapse,
    component: CollapseGallery,
  },
  {
    name: StackRoutes.ComponentBottomSheetModal,
    component: BottomSheetModalGallery,
  },
  { name: StackRoutes.ComponentNavHeaderGallery, component: NavHeaderGallery },
];

const DevStack = createNativeStackNavigator();

const DevScreen = () => {
  const [bgColor, textColor] = useThemeValue([
    'surface-subdued',
    'text-default',
  ]);

  return (
    <DevStack.Navigator>
      <DevStack.Group
        screenOptions={{
          headerBackTitle: '',
          headerTitleAlign: 'center',
          headerStyle: {
            backgroundColor: bgColor,
          },
          header: renderCustomSubStackHeader,
          headerTintColor: textColor,
        }}
      >
        {stackScreenList.map((stack) => (
          <DevStack.Screen
            key={stack.name}
            name={stack.name}
            component={stack.component}
          />
        ))}
      </DevStack.Group>
    </DevStack.Navigator>
  );
};

export default DevScreen;
