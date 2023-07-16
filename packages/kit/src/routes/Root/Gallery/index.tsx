import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useThemeValue } from '@onekeyhq/components';

import ComponentsScreen from '../../../views/Components';
import AccountGallery from '../../../views/Components/stories/Account';
import AccountSelectorGallery from '../../../views/Components/stories/AccountSelector';
import AddressGallery from '../../../views/Components/stories/Address';
import AlertGallery from '../../../views/Components/stories/Alert';
import AppUpdateGallery from '../../../views/Components/stories/AppUpdate';
import BadgeGallery from '../../../views/Components/stories/Badge';
import BottomSheetModalGallery from '../../../views/Components/stories/BottomSheetModal';
import ButtonsGallery from '../../../views/Components/stories/Buttons';
import CheckBoxGallery from '../../../views/Components/stories/CheckBox';
import CollapseGallery from '../../../views/Components/stories/Collapse';
import ContainerGallery from '../../../views/Components/stories/Container';
import DialogGallery from '../../../views/Components/stories/Dialog';
import DotMapGallery from '../../../views/Components/stories/DotMap';
import EmojiGallery from '../../../views/Components/stories/Emoji';
import EmptyGallery from '../../../views/Components/stories/Empty';
import FormGallery from '../../../views/Components/stories/Form';
import HardwareHomescreen from '../../../views/Components/stories/HardwareHomescreen';
import IconGallery from '../../../views/Components/stories/Icon';
import IconButtons from '../../../views/Components/stories/IconButtons';
import ImageViewerGallery from '../../../views/Components/stories/ImageViewer';
import InAppNotificationGallery from '../../../views/Components/stories/InAppNotification';
import InputGallery from '../../../views/Components/stories/Input';
import KeyboardGallery from '../../../views/Components/stories/Keyboard';
import ListGallery from '../../../views/Components/stories/List';
import LoggerGallery from '../../../views/Components/stories/Logger';
import MarkdownGallery from '../../../views/Components/stories/Markdown';
import MenuGallery from '../../../views/Components/stories/Menu';
import MnemonicCardGallery from '../../../views/Components/stories/MnemonicCard';
import ModalGallery from '../../../views/Components/stories/Modal';
import NavHeaderGallery from '../../../views/Components/stories/NavHeader';
import NftCardGallery from '../../../views/Components/stories/NftCard';
import NFTImageGallery from '../../../views/Components/stories/NFTImage';
import PageActionsGallery from '../../../views/Components/stories/PageActions';
import PinCodeGallery from '../../../views/Components/stories/PinCode';
import PopoverGallery from '../../../views/Components/stories/Popover';
import PriceChart from '../../../views/Components/stories/PriceChart';
import QRCodeGallery from '../../../views/Components/stories/QRCode';
import RadioGallery from '../../../views/Components/stories/Radio';
import RadioBoxGallery from '../../../views/Components/stories/RadioBox';
import RestfulRequest from '../../../views/Components/stories/RestfulRequest';
import SearchbarGallery from '../../../views/Components/stories/Searchbar';
import SegmentedControl from '../../../views/Components/stories/SegmentedControl';
import SelectGallery from '../../../views/Components/stories/Select';
import ShadowsGallery from '../../../views/Components/stories/Shadows';
import SkeletonGallery from '../../../views/Components/stories/Skeleton';
import SliderGallery from '../../../views/Components/stories/Slider';
import SortableListGallery from '../../../views/Components/stories/SortableList';
import SpinnerGallery from '../../../views/Components/stories/Spinner';
import SwitchGallery from '../../../views/Components/stories/Switch';
import TabsGallery from '../../../views/Components/stories/Tabs';
import TextareaGallery from '../../../views/Components/stories/Textarea';
import ThemeGallery from '../../../views/Components/stories/Theme';
import ToastGallery from '../../../views/Components/stories/Toast';
import ToggleButtonGroupGallery from '../../../views/Components/stories/ToggleButtonGroup';
import TypeWriter from '../../../views/Components/stories/TypeWriter';
import TypographyGallery from '../../../views/Components/stories/Typography';
import WalletSelectorGallery from '../../../views/Components/stories/WalletSelector';
import WebViewGallery from '../../../views/Components/stories/WebView';
import { GalleryRoutes } from '../../routesEnum';
import renderCustomSubStackHeader from '../Main/Header';

export type GalleryParams = {
  [GalleryRoutes.Components]: { ts: number };
  [GalleryRoutes.ComponentApproval]: undefined;
  [GalleryRoutes.ComponentSearchBar]: undefined;
  [GalleryRoutes.ComponentTextarea]: undefined;
  [GalleryRoutes.ComponentAddress]: undefined;
  [GalleryRoutes.ComponentInput]: undefined;
  [GalleryRoutes.ComponentCard]: undefined;
  [GalleryRoutes.ComponentDappModals]: undefined;
  [GalleryRoutes.ComponentTypography]: undefined;
  [GalleryRoutes.ComponentToken]: undefined;
  [GalleryRoutes.ComponentTheme]: undefined;
  [GalleryRoutes.ComponentIcon]: undefined;
  [GalleryRoutes.ComponentBadge]: undefined;
  [GalleryRoutes.ComponentMenu]: undefined;
  [GalleryRoutes.ComponentAlert]: undefined;
  [GalleryRoutes.ComponentButton]: undefined;
  [GalleryRoutes.ComponentIconButton]: undefined;
  [GalleryRoutes.ComponentSelect]: undefined;
  [GalleryRoutes.ComponentShadow]: undefined;
  [GalleryRoutes.ComponentEmpty]: undefined;
  [GalleryRoutes.ComponentToast]: undefined;
  [GalleryRoutes.ComponentAccount]: undefined;
  [GalleryRoutes.ComponentWalletSelector]: undefined;
  [GalleryRoutes.ComponentAccountSelector]: undefined;
  [GalleryRoutes.ComponentCheckbox]: undefined;
  [GalleryRoutes.ComponentSpinner]: undefined;
  [GalleryRoutes.ComponentModal]: undefined;
  [GalleryRoutes.ComponentRadio]: undefined;
  [GalleryRoutes.ComponentRadioBox]: undefined;
  [GalleryRoutes.ComponentSwitch]: undefined;
  [GalleryRoutes.ComponentForm]: undefined;
  [GalleryRoutes.ComponentQRCode]: undefined;
  [GalleryRoutes.ComponentMarkdown]: undefined;
  [GalleryRoutes.ComponentDialog]: undefined;
  [GalleryRoutes.ComponentPageActions]: undefined;
  [GalleryRoutes.ComponentSortableList]: undefined;
  [GalleryRoutes.ComponentTabs]: undefined;
  [GalleryRoutes.ComponentSegmentedControl]: undefined;
  [GalleryRoutes.ComponentReduxMessage]: undefined;
  [GalleryRoutes.ComponentLogger]: undefined;
  [GalleryRoutes.ComponentFirebase]: undefined;
  [GalleryRoutes.ComponentWebview]: undefined;
  [GalleryRoutes.ComponentPinCode]: undefined;
  [GalleryRoutes.ComponentRestfulRequest]: undefined;
  [GalleryRoutes.ComponentImageViewer]: undefined;
  [GalleryRoutes.ComponentEmojiList]: undefined;
  [GalleryRoutes.ComponentContentBox]: undefined;
  [GalleryRoutes.ComponentAppUpdate]: undefined;
  [GalleryRoutes.ComponentSkeleton]: undefined;
  [GalleryRoutes.ComponentKeyboard]: undefined;
  [GalleryRoutes.ComponentPopover]: undefined;
  [GalleryRoutes.ComponentPriceChart]: undefined;
  [GalleryRoutes.ComponentTypeWriter]: undefined;
  [GalleryRoutes.ComponentHomescreen]: undefined;
  [GalleryRoutes.ComponentNFTImage]: undefined;
  [GalleryRoutes.ComponentList]: undefined;
  [GalleryRoutes.ComponentToggleButtonGroup]: undefined;
  [GalleryRoutes.ComponentCollapse]: undefined;
  [GalleryRoutes.ComponentDotMap]: undefined;
  [GalleryRoutes.ComponentBottomSheetModal]: undefined;
  [GalleryRoutes.ComponentNavHeaderGallery]: undefined;
  [GalleryRoutes.ComponentMnemonicCardGallery]: undefined;
  [GalleryRoutes.ComponentSlider]: undefined;
  [GalleryRoutes.ComponentInAppNotification]: undefined;
};

export const stackScreenList = [
  { name: GalleryRoutes.Components, component: ComponentsScreen },
  { name: GalleryRoutes.ComponentTextarea, component: TextareaGallery },
  { name: GalleryRoutes.ComponentSearchBar, component: SearchbarGallery },
  { name: GalleryRoutes.ComponentAddress, component: AddressGallery },
  { name: GalleryRoutes.ComponentInput, component: InputGallery },
  { name: GalleryRoutes.ComponentCard, component: NftCardGallery },
  {
    name: GalleryRoutes.ComponentTypography,
    component: TypographyGallery,
  },
  { name: GalleryRoutes.ComponentNFTImage, component: NFTImageGallery },
  { name: GalleryRoutes.ComponentTheme, component: ThemeGallery },
  { name: GalleryRoutes.ComponentIcon, component: IconGallery },
  { name: GalleryRoutes.ComponentBadge, component: BadgeGallery },
  { name: GalleryRoutes.ComponentMenu, component: MenuGallery },
  { name: GalleryRoutes.ComponentList, component: ListGallery },
  { name: GalleryRoutes.ComponentAlert, component: AlertGallery },
  { name: GalleryRoutes.ComponentButton, component: ButtonsGallery },
  { name: GalleryRoutes.ComponentIconButton, component: IconButtons },
  { name: GalleryRoutes.ComponentSelect, component: SelectGallery },
  { name: GalleryRoutes.ComponentEmpty, component: EmptyGallery },
  { name: GalleryRoutes.ComponentToast, component: ToastGallery },
  { name: GalleryRoutes.ComponentAccount, component: AccountGallery },
  {
    name: GalleryRoutes.ComponentWalletSelector,
    component: WalletSelectorGallery,
  },
  {
    name: GalleryRoutes.ComponentAccountSelector,
    component: AccountSelectorGallery,
  },
  { name: GalleryRoutes.ComponentCheckbox, component: CheckBoxGallery },
  { name: GalleryRoutes.ComponentSpinner, component: SpinnerGallery },
  { name: GalleryRoutes.ComponentModal, component: ModalGallery },
  { name: GalleryRoutes.ComponentRadio, component: RadioGallery },
  { name: GalleryRoutes.ComponentRadioBox, component: RadioBoxGallery },
  { name: GalleryRoutes.ComponentSwitch, component: SwitchGallery },
  { name: GalleryRoutes.ComponentForm, component: FormGallery },
  { name: GalleryRoutes.ComponentQRCode, component: QRCodeGallery },
  { name: GalleryRoutes.ComponentMarkdown, component: MarkdownGallery },
  { name: GalleryRoutes.ComponentDialog, component: DialogGallery },
  {
    name: GalleryRoutes.ComponentPageActions,
    component: PageActionsGallery,
  },
  {
    name: GalleryRoutes.ComponentSortableList,
    component: SortableListGallery,
  },
  { name: GalleryRoutes.ComponentTabs, component: TabsGallery },
  {
    name: GalleryRoutes.ComponentSegmentedControl,
    component: SegmentedControl,
  },
  { name: GalleryRoutes.ComponentShadow, component: ShadowsGallery },
  { name: GalleryRoutes.ComponentPinCode, component: PinCodeGallery },
  { name: GalleryRoutes.ComponentAppUpdate, component: AppUpdateGallery },
  { name: GalleryRoutes.ComponentSkeleton, component: SkeletonGallery },
  {
    name: GalleryRoutes.ComponentRestfulRequest,
    component: RestfulRequest,
  },
  {
    name: GalleryRoutes.ComponentLogger,
    component: LoggerGallery,
  },
  {
    name: GalleryRoutes.ComponentWebview,
    component: WebViewGallery,
  },
  {
    name: GalleryRoutes.ComponentImageViewer,
    component: ImageViewerGallery,
  },
  {
    name: GalleryRoutes.ComponentEmojiList,
    component: EmojiGallery,
  },
  {
    name: GalleryRoutes.ComponentContentBox,
    component: ContainerGallery,
  },
  {
    name: GalleryRoutes.ComponentKeyboard,
    component: KeyboardGallery,
  },
  {
    name: GalleryRoutes.ComponentPopover,
    component: PopoverGallery,
  },
  { name: GalleryRoutes.ComponentPriceChart, component: PriceChart },
  { name: GalleryRoutes.ComponentTypeWriter, component: TypeWriter },
  {
    name: GalleryRoutes.ComponentHomescreen,
    component: HardwareHomescreen,
  },
  {
    name: GalleryRoutes.ComponentToggleButtonGroup,
    component: ToggleButtonGroupGallery,
  },
  {
    name: GalleryRoutes.ComponentCollapse,
    component: CollapseGallery,
  },
  { name: GalleryRoutes.ComponentDotMap, component: DotMapGallery },
  {
    name: GalleryRoutes.ComponentBottomSheetModal,
    component: BottomSheetModalGallery,
  },
  {
    name: GalleryRoutes.ComponentNavHeaderGallery,
    component: NavHeaderGallery,
  },
  {
    name: GalleryRoutes.ComponentMnemonicCardGallery,
    component: MnemonicCardGallery,
  },
  {
    name: GalleryRoutes.ComponentSlider,
    component: SliderGallery,
  },
  {
    name: GalleryRoutes.ComponentInAppNotification,
    component: InAppNotificationGallery,
  },
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
