import { createStackNavigator } from '@onekeyhq/components';
import ComponentsScreen from '@onekeyhq/kit/src/views/Components';
import ActionListGallery from '@onekeyhq/kit/src/views/Components/stories/ActionList';
import BadgeGallery from '@onekeyhq/kit/src/views/Components/stories/Badge';
import ButtonsGallery from '@onekeyhq/kit/src/views/Components/stories/Buttons';
import CheckboxGallery from '@onekeyhq/kit/src/views/Components/stories/Checkbox';
import CollapsibleTabViewGallery from '@onekeyhq/kit/src/views/Components/stories/CollapsibleTabView';
import DialogGallery from '@onekeyhq/kit/src/views/Components/stories/Dialog';
import IconGallery from '@onekeyhq/kit/src/views/Components/stories/Icon';
import IconButtonGallery from '@onekeyhq/kit/src/views/Components/stories/IconButton';
import InputGallery from '@onekeyhq/kit/src/views/Components/stories/Input';
import LottieViewGallery from '@onekeyhq/kit/src/views/Components/stories/LottieView';
import DemoRootApp from '@onekeyhq/kit/src/views/Components/stories/NavigatorRoute';
import NewButtonGallery from '@onekeyhq/kit/src/views/Components/stories/NewButton';
import NewIconButtonGallery from '@onekeyhq/kit/src/views/Components/stories/NewIconButton';
import PopoverGallery from '@onekeyhq/kit/src/views/Components/stories/Popover';
import ProgressGallery from '@onekeyhq/kit/src/views/Components/stories/Progress';
import RadioGallery from '@onekeyhq/kit/src/views/Components/stories/Radio';
import SelectGallery from '@onekeyhq/kit/src/views/Components/stories/Select';
import SliderGallery from '@onekeyhq/kit/src/views/Components/stories/Slider';
import SwitchGallery from '@onekeyhq/kit/src/views/Components/stories/Switch';
import ToastGallery from '@onekeyhq/kit/src/views/Components/stories/Toast';
import TypographyGallery from '@onekeyhq/kit/src/views/Components/stories/Typography';

import AlertGallery from '../../views/Components/stories/Alert';
import DividerGallery from '../../views/Components/stories/Divider';
import FormGallery from '../../views/Components/stories/Form';
import QRCodeGallery from '../../views/Components/stories/QRCode';
import TextAreaGallery from '../../views/Components/stories/TextArea';
import ThemeGallery from '../../views/Components/stories/Theme';

export enum GalleryRoutes {
  Components = 'components',
  ComponentTypography = 'component/typography',
  ComponentLottieView = 'component/lottieview',
  ComponentIcon = 'component/icon',
  ComponentButton = 'component/button',
  ComponentSelect = 'component/select',
  ComponentIconButton = 'component/iconbutton',
  ComponentBadge = 'component/badge',
  ComponentDialog = 'component/dialog',
  ComponentNewButton = 'component/newButton',
  ComponentForm = 'component/form',
  ComponentNavigation = 'component/navigation',
  ComponentSwitch = 'component/switch',
  ComponentInput = 'component/input',
  ComponentAlert = 'component/alert',
  ComponentRadio = 'component/radio',
  ComponentDivider = 'component/divider',
  ComponentToast = 'component/toast',
  ComponentCheckbox = 'component/checkbox',
  ComponentActionList = 'component/actionlist',
  ComponentNewIconButton = 'component/newIconButton',
  ComponentProgress = 'component/progress',
  ComponentSlider = 'component/slider',
  ComponentTextArea = 'component/textArea',
  ComponentPopover = 'component/popover',
  ComponentTheme = 'component/theme',
  ComponentCollapsibleTabs = 'component/collapsibleTabs',
  componentQRCode = 'component/qrCode',
}

export const stackScreenList = [
  { name: GalleryRoutes.Components, component: ComponentsScreen },
  {
    name: GalleryRoutes.ComponentTypography,
    component: TypographyGallery,
  },
  {
    name: GalleryRoutes.ComponentLottieView,
    component: LottieViewGallery,
  },
  { name: GalleryRoutes.ComponentIcon, component: IconGallery },
  { name: GalleryRoutes.ComponentToast, component: ToastGallery },
  { name: GalleryRoutes.ComponentIconButton, component: IconButtonGallery },
  { name: GalleryRoutes.ComponentButton, component: ButtonsGallery },
  { name: GalleryRoutes.ComponentSelect, component: SelectGallery },
  { name: GalleryRoutes.ComponentBadge, component: BadgeGallery },
  { name: GalleryRoutes.ComponentInput, component: InputGallery },
  { name: GalleryRoutes.ComponentDialog, component: DialogGallery },
  { name: GalleryRoutes.ComponentRadio, component: RadioGallery },
  { name: GalleryRoutes.ComponentCheckbox, component: CheckboxGallery },
  { name: GalleryRoutes.ComponentActionList, component: ActionListGallery },
  { name: GalleryRoutes.ComponentPopover, component: PopoverGallery },
  { name: GalleryRoutes.ComponentProgress, component: ProgressGallery },
  {
    name: GalleryRoutes.ComponentNewIconButton,
    component: NewIconButtonGallery,
  },
  { name: GalleryRoutes.ComponentSwitch, component: SwitchGallery },
  { name: GalleryRoutes.ComponentNewButton, component: NewButtonGallery },
  { name: GalleryRoutes.ComponentTextArea, component: TextAreaGallery },
  { name: GalleryRoutes.ComponentSlider, component: SliderGallery },
  {
    name: GalleryRoutes.ComponentNavigation,
    component: DemoRootApp,
    options: { headerShown: false },
  },
  { name: GalleryRoutes.ComponentAlert, component: AlertGallery },
  { name: GalleryRoutes.ComponentDivider, component: DividerGallery },
  { name: GalleryRoutes.ComponentTheme, component: ThemeGallery },
  {
    name: GalleryRoutes.ComponentForm,
    component: FormGallery,
  },
  {
    name: GalleryRoutes.ComponentCollapsibleTabs,
    component: CollapsibleTabViewGallery,
    // options: { headerShown: false },
  },
  {
    name: GalleryRoutes.componentQRCode,
    component: QRCodeGallery,
  },
];

const DevStack = createStackNavigator();

const DevScreen = () => (
  <DevStack.Navigator
    screenOptions={{
      cardStyle: {
        flex: 1,
      },
    }}
  >
    <DevStack.Group>
      {stackScreenList.map((stack) => (
        <DevStack.Screen
          key={stack.name}
          name={stack.name}
          component={stack.component}
          options={stack.options}
        />
      ))}
    </DevStack.Group>
  </DevStack.Navigator>
);

export default DevScreen;
