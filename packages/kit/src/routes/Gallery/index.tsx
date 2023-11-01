import { useTheme } from '@tamagui/core';

import { createStackNavigator } from '@onekeyhq/components';
import ComponentsScreen from '@onekeyhq/kit/src/views/Components';
import ActionListGallery from '@onekeyhq/kit/src/views/Components/stories/ActionList';
import BadgeGallery from '@onekeyhq/kit/src/views/Components/stories/Badge';
import ButtonGallery from '@onekeyhq/kit/src/views/Components/stories/Button';
import CheckboxGallery from '@onekeyhq/kit/src/views/Components/stories/Checkbox';
import DialogGallery from '@onekeyhq/kit/src/views/Components/stories/Dialog';
import EmptyGallery from '@onekeyhq/kit/src/views/Components/stories/Empty';
import IconGallery from '@onekeyhq/kit/src/views/Components/stories/Icon';
import IconButtonGallery from '@onekeyhq/kit/src/views/Components/stories/IconButton';
import InputGallery from '@onekeyhq/kit/src/views/Components/stories/Input';
import ListItemGallery from '@onekeyhq/kit/src/views/Components/stories/ListItem';
import LottieViewGallery from '@onekeyhq/kit/src/views/Components/stories/LottieView';
import DemoRootApp from '@onekeyhq/kit/src/views/Components/stories/NavigatorRoute';
import PopoverGallery from '@onekeyhq/kit/src/views/Components/stories/Popover';
import ProgressGallery from '@onekeyhq/kit/src/views/Components/stories/Progress';
import RadioGallery from '@onekeyhq/kit/src/views/Components/stories/Radio';
import SegmentControlGallery from '@onekeyhq/kit/src/views/Components/stories/SegmentControl';
import SelectGallery from '@onekeyhq/kit/src/views/Components/stories/Select';
import SliderGallery from '@onekeyhq/kit/src/views/Components/stories/Slider';
import SwitchGallery from '@onekeyhq/kit/src/views/Components/stories/Switch';
import TabViewGallery from '@onekeyhq/kit/src/views/Components/stories/TabView';
import ToastGallery from '@onekeyhq/kit/src/views/Components/stories/Toast';
import ToggleGroupGallery from '@onekeyhq/kit/src/views/Components/stories/ToggleGroup';
import TooltipGallery from '@onekeyhq/kit/src/views/Components/stories/Tooltip';
import TypographyGallery from '@onekeyhq/kit/src/views/Components/stories/Typography';
import WebviewGallery from '@onekeyhq/kit/src/views/Components/stories/WebView';

import AlertGallery from '../../views/Components/stories/Alert';
import DividerGallery from '../../views/Components/stories/Divider';
import FormGallery from '../../views/Components/stories/Form';
import ListViewGallery from '../../views/Components/stories/ListView';
import QRCodeGallery from '../../views/Components/stories/QRCode';
import ScrollViewGallery from '../../views/Components/stories/ScrollView';
import SectionListGallery from '../../views/Components/stories/SectionList';
import SkeletonGallery from '../../views/Components/stories/Skeleton';
import TextAreaGallery from '../../views/Components/stories/TextArea';
import ThemeGallery from '../../views/Components/stories/Theme';

import { GalleryRoutes } from './routes';

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
  { name: GalleryRoutes.ComponentSelect, component: SelectGallery },
  { name: GalleryRoutes.ComponentTooltip, component: TooltipGallery },
  { name: GalleryRoutes.ComponentBadge, component: BadgeGallery },
  { name: GalleryRoutes.ComponentInput, component: InputGallery },
  { name: GalleryRoutes.ComponentDialog, component: DialogGallery },
  { name: GalleryRoutes.ComponentEmpty, component: EmptyGallery },
  { name: GalleryRoutes.ComponentRadio, component: RadioGallery },
  { name: GalleryRoutes.ComponentListView, component: ListViewGallery },
  { name: GalleryRoutes.ComponentSectionList, component: SectionListGallery },
  { name: GalleryRoutes.ComponentListItem, component: ListItemGallery },
  { name: GalleryRoutes.ComponentSkeleton, component: SkeletonGallery },
  { name: GalleryRoutes.ComponentCheckbox, component: CheckboxGallery },
  { name: GalleryRoutes.ComponentToggleGroup, component: ToggleGroupGallery },
  { name: GalleryRoutes.ComponentActionList, component: ActionListGallery },
  { name: GalleryRoutes.ComponentPopover, component: PopoverGallery },
  { name: GalleryRoutes.ComponentProgress, component: ProgressGallery },
  {
    name: GalleryRoutes.ComponentIconButton,
    component: IconButtonGallery,
  },
  { name: GalleryRoutes.ComponentSwitch, component: SwitchGallery },
  { name: GalleryRoutes.ComponentButton, component: ButtonGallery },
  { name: GalleryRoutes.ComponentTextArea, component: TextAreaGallery },
  { name: GalleryRoutes.ComponentSlider, component: SliderGallery },
  {
    name: GalleryRoutes.ComponentNavigation,
    component: DemoRootApp,
    options: { headerShown: false },
  },
  {
    name: GalleryRoutes.ComponentSegmentControl,
    component: SegmentControlGallery,
  },
  { name: GalleryRoutes.ComponentAlert, component: AlertGallery },
  { name: GalleryRoutes.ComponentDivider, component: DividerGallery },
  { name: GalleryRoutes.ComponentTheme, component: ThemeGallery },
  { name: GalleryRoutes.ComponentScrollView, component: ScrollViewGallery },
  {
    name: GalleryRoutes.ComponentForm,
    component: FormGallery,
  },
  {
    name: GalleryRoutes.ComponentTabview,
    component: TabViewGallery,
  },
  {
    name: GalleryRoutes.componentQRCode,
    component: QRCodeGallery,
  },
  {
    name: GalleryRoutes.ComponentWebview,
    component: WebviewGallery,
  },
];

const DevStack = createStackNavigator();

const DevScreen = () => {
  const theme = useTheme();
  return (
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
            options={() => ({
              headerStyle: {
                backgroundColor: theme.bgApp.val,
              },
              headerTintColor: theme.text.val,
              headerShadowVisible: false,
              ...stack.options,
            })}
          />
        ))}
      </DevStack.Group>
    </DevStack.Navigator>
  );
};

export default DevScreen;
