import ComponentsScreen from '@onekeyhq/kit/src/views/Components';
import AccountModelGallery from '@onekeyhq/kit/src/views/Components/stories/AccountModelGallery';
import ActionListGallery from '@onekeyhq/kit/src/views/Components/stories/ActionList';
import AlertGallery from '@onekeyhq/kit/src/views/Components/stories/Alert';
import BadgeGallery from '@onekeyhq/kit/src/views/Components/stories/Badge';
import BlurViewGallery from '@onekeyhq/kit/src/views/Components/stories/BlurView';
import ButtonGallery from '@onekeyhq/kit/src/views/Components/stories/Button';
import CheckboxGallery from '@onekeyhq/kit/src/views/Components/stories/Checkbox';
import DialogGallery from '@onekeyhq/kit/src/views/Components/stories/Dialog';
import DividerGallery from '@onekeyhq/kit/src/views/Components/stories/Divider';
import EmptyGallery from '@onekeyhq/kit/src/views/Components/stories/Empty';
import ErrorToastGallery from '@onekeyhq/kit/src/views/Components/stories/ErrorToastGallery';
import FormGallery from '@onekeyhq/kit/src/views/Components/stories/Form';
import IconGallery from '@onekeyhq/kit/src/views/Components/stories/Icon';
import IconButtonGallery from '@onekeyhq/kit/src/views/Components/stories/IconButton';
import InputGallery from '@onekeyhq/kit/src/views/Components/stories/Input';
import JotaiContextGallery from '@onekeyhq/kit/src/views/Components/stories/JotaiContextGallery';
import JotaiGlobalGallery from '@onekeyhq/kit/src/views/Components/stories/JotaiGlobalGallery';
import ListItemGallery from '@onekeyhq/kit/src/views/Components/stories/ListItem';
import ListViewGallery from '@onekeyhq/kit/src/views/Components/stories/ListView';
import LocalDBGallery from '@onekeyhq/kit/src/views/Components/stories/LocalDBGallery';
import LottieViewGallery from '@onekeyhq/kit/src/views/Components/stories/LottieView';
import DemoRootApp from '@onekeyhq/kit/src/views/Components/stories/NavigatorRoute';
import PasswordDemoGallery from '@onekeyhq/kit/src/views/Components/stories/PasswordDemo';
import PopoverGallery from '@onekeyhq/kit/src/views/Components/stories/Popover';
import ProgressGallery from '@onekeyhq/kit/src/views/Components/stories/Progress';
import QRCodeGallery from '@onekeyhq/kit/src/views/Components/stories/QRCode';
import RadioGallery from '@onekeyhq/kit/src/views/Components/stories/Radio';
import RefreshControlGallery from '@onekeyhq/kit/src/views/Components/stories/RefreshControl';
import ScrollViewGallery from '@onekeyhq/kit/src/views/Components/stories/ScrollView';
import SectionListGallery from '@onekeyhq/kit/src/views/Components/stories/SectionList';
import SegmentControlGallery from '@onekeyhq/kit/src/views/Components/stories/SegmentControl';
import SelectGallery from '@onekeyhq/kit/src/views/Components/stories/Select';
import ShortcutGallery from '@onekeyhq/kit/src/views/Components/stories/Shortcut';
import SkeletonGallery from '@onekeyhq/kit/src/views/Components/stories/Skeleton';
import SliderGallery from '@onekeyhq/kit/src/views/Components/stories/Slider';
import SwitchGallery from '@onekeyhq/kit/src/views/Components/stories/Switch';
import TabViewGallery from '@onekeyhq/kit/src/views/Components/stories/TabView';
import TextAreaGallery from '@onekeyhq/kit/src/views/Components/stories/TextArea';
import ToastGallery from '@onekeyhq/kit/src/views/Components/stories/Toast';
import TooltipGallery from '@onekeyhq/kit/src/views/Components/stories/Tooltip';
import TypographyGallery from '@onekeyhq/kit/src/views/Components/stories/Typography';
import WebviewGallery from '@onekeyhq/kit/src/views/Components/stories/WebView';

import { EGalleryRoutes } from './routes';

export const galleryScreenList: {
  name: EGalleryRoutes;
  component: () => React.JSX.Element;
}[] = [
  { name: EGalleryRoutes.Components, component: ComponentsScreen },
  {
    name: EGalleryRoutes.ComponentTypography,
    component: TypographyGallery,
  },
  {
    name: EGalleryRoutes.ComponentLottieView,
    component: LottieViewGallery,
  },
  { name: EGalleryRoutes.ComponentIcon, component: IconGallery },
  { name: EGalleryRoutes.ComponentToast, component: ToastGallery },
  { name: EGalleryRoutes.ComponentShortcut, component: ShortcutGallery },
  { name: EGalleryRoutes.ComponentSelect, component: SelectGallery },
  { name: EGalleryRoutes.ComponentTooltip, component: TooltipGallery },
  { name: EGalleryRoutes.ComponentBadge, component: BadgeGallery },
  { name: EGalleryRoutes.ComponentInput, component: InputGallery },
  { name: EGalleryRoutes.ComponentDialog, component: DialogGallery },
  { name: EGalleryRoutes.ComponentEmpty, component: EmptyGallery },
  { name: EGalleryRoutes.ComponentRadio, component: RadioGallery },
  { name: EGalleryRoutes.ComponentListView, component: ListViewGallery },
  { name: EGalleryRoutes.ComponentSectionList, component: SectionListGallery },
  { name: EGalleryRoutes.ComponentListItem, component: ListItemGallery },
  { name: EGalleryRoutes.ComponentSkeleton, component: SkeletonGallery },
  { name: EGalleryRoutes.ComponentCheckbox, component: CheckboxGallery },
  { name: EGalleryRoutes.ComponentActionList, component: ActionListGallery },
  { name: EGalleryRoutes.ComponentPopover, component: PopoverGallery },
  { name: EGalleryRoutes.ComponentProgress, component: ProgressGallery },
  {
    name: EGalleryRoutes.ComponentPasswordDemo,
    component: PasswordDemoGallery,
  },
  {
    name: EGalleryRoutes.ComponentIconButton,
    component: IconButtonGallery,
  },
  { name: EGalleryRoutes.ComponentSwitch, component: SwitchGallery },
  { name: EGalleryRoutes.ComponentButton, component: ButtonGallery },
  { name: EGalleryRoutes.ComponentTextArea, component: TextAreaGallery },
  { name: EGalleryRoutes.ComponentSlider, component: SliderGallery },
  {
    name: EGalleryRoutes.ComponentNavigation,
    component: DemoRootApp,
    // options: { headerShown: false },
  },
  {
    name: EGalleryRoutes.ComponentSegmentControl,
    component: SegmentControlGallery,
  },
  { name: EGalleryRoutes.ComponentAlert, component: AlertGallery },
  { name: EGalleryRoutes.ComponentDivider, component: DividerGallery },
  { name: EGalleryRoutes.ComponentScrollView, component: ScrollViewGallery },
  {
    name: EGalleryRoutes.ComponentAccountModel,
    component: AccountModelGallery,
  },
  {
    name: EGalleryRoutes.ComponentJotaiContext,
    component: JotaiContextGallery,
  },
  { name: EGalleryRoutes.ComponentJotaiGlobal, component: JotaiGlobalGallery },
  { name: EGalleryRoutes.ComponentLocalDB, component: LocalDBGallery },
  { name: EGalleryRoutes.ComponentErrorToast, component: ErrorToastGallery },
  {
    name: EGalleryRoutes.ComponentForm,
    component: FormGallery,
  },
  {
    name: EGalleryRoutes.ComponentTabview,
    component: TabViewGallery,
  },
  {
    name: EGalleryRoutes.componentQRCode,
    component: QRCodeGallery,
  },
  {
    name: EGalleryRoutes.ComponentWebview,
    component: WebviewGallery,
  },
  {
    name: EGalleryRoutes.ComponentRefreshControl,
    component: RefreshControlGallery,
  },
  {
    name: EGalleryRoutes.ComponentBlurView,
    component: BlurViewGallery,
  },
];
