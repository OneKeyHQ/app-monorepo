import { createStackNavigator } from '@onekeyhq/components';
import ComponentsScreen from '@onekeyhq/kit/src/views/Components';
import ActionListGallery from '@onekeyhq/kit/src/views/Components/stories/ActionList';
import BadgeGallery from '@onekeyhq/kit/src/views/Components/stories/Badge';
import ButtonsGallery from '@onekeyhq/kit/src/views/Components/stories/Buttons';
import CollapsibleTabViewGallery from '@onekeyhq/kit/src/views/Components/stories/CollapsibleTabView';
import DialogGallery from '@onekeyhq/kit/src/views/Components/stories/Dialog';
import IconGallery from '@onekeyhq/kit/src/views/Components/stories/Icon';
import IconButtonGallery from '@onekeyhq/kit/src/views/Components/stories/IconButton';
import DemoRootApp from '@onekeyhq/kit/src/views/Components/stories/NavigatorRoute';
import PopoverGallery from '@onekeyhq/kit/src/views/Components/stories/Popover';
import ProgressGallery from '@onekeyhq/kit/src/views/Components/stories/Progress';
import SelectGallery from '@onekeyhq/kit/src/views/Components/stories/Select';
import SliderGallery from '@onekeyhq/kit/src/views/Components/stories/Slider';
import ToastGallery from '@onekeyhq/kit/src/views/Components/stories/Toast';
import TypographyGallery from '@onekeyhq/kit/src/views/Components/stories/Typography';

import AlertGallery from '../../views/Components/stories/Alert';
import DividerGallery from '../../views/Components/stories/Divider';
import FormGallery from '../../views/Components/stories/Form';
import ThemeGallery from '../../views/Components/stories/Theme';

export enum GalleryRoutes {
  Components = 'components',
  ComponentTypography = 'component/typography',
  ComponentIcon = 'component/icon',
  ComponentButton = 'component/button',
  ComponentSelect = 'component/select',
  ComponentIconButton = 'component/iconbutton',
  ComponentBadge = 'component/badge',
  ComponentDialog = 'component/dialog',
  ComponentForm = 'component/form',
  ComponentNavigation = 'component/navigation',
  ComponentAlert = 'component/alert',
  ComponentDivider = 'component/divider',
  ComponentToast = 'component/toast',
  ComponentActionList = 'component/actionlist',
  ComponentProgress = 'component/progress',
  ComponentSlider = 'component/slider',
  ComponentPopover = 'component/popover',
  ComponentTheme = 'component/theme',
  ComponentCollapsibleTabs = 'component/collapsibleTabs',
}

export const stackScreenList = [
  { name: GalleryRoutes.Components, component: ComponentsScreen },
  {
    name: GalleryRoutes.ComponentTypography,
    component: TypographyGallery,
  },
  { name: GalleryRoutes.ComponentIcon, component: IconGallery },
  { name: GalleryRoutes.ComponentToast, component: ToastGallery },
  { name: GalleryRoutes.ComponentIconButton, component: IconButtonGallery },
  { name: GalleryRoutes.ComponentButton, component: ButtonsGallery },
  { name: GalleryRoutes.ComponentSelect, component: SelectGallery },
  { name: GalleryRoutes.ComponentBadge, component: BadgeGallery },
  { name: GalleryRoutes.ComponentDialog, component: DialogGallery },
  { name: GalleryRoutes.ComponentActionList, component: ActionListGallery },
  { name: GalleryRoutes.ComponentPopover, component: PopoverGallery },
  { name: GalleryRoutes.ComponentProgress, component: ProgressGallery },
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
];

const DevStack = createStackNavigator();

const DevScreen = () => (
  <DevStack.Navigator>
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
