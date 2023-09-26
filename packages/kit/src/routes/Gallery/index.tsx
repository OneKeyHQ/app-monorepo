import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ComponentsScreen from '@onekeyhq/kit/src/views/Components';
import BadgeGallery from '@onekeyhq/kit/src/views/Components/stories/Badge';
import ButtonsGallery from '@onekeyhq/kit/src/views/Components/stories/Buttons';
import IconGallery from '@onekeyhq/kit/src/views/Components/stories/Icon';
import IconButtonGallery from '@onekeyhq/kit/src/views/Components/stories/IconButton';
import SelectGallery from '@onekeyhq/kit/src/views/Components/stories/Select';
import ToastGallery from '@onekeyhq/kit/src/views/Components/stories/Toast';
import TypographyGallery from '@onekeyhq/kit/src/views/Components/stories/Typography';

import AlertGallery from '../../views/Components/stories/Alert';
import DialogGallery from '../../views/Components/stories/Dialog';
import DividerGallery from '../../views/Components/stories/Divider';
import DemoRootApp from '../../views/Components/stories/NavigatorRoute';

export enum GalleryRoutes {
  Components = 'components',
  ComponentTypography = 'component/typography',
  ComponentIcon = 'component/icon',
  ComponentButton = 'component/button',
  ComponentSelect = 'component/select',
  ComponentIconButton = 'component/iconbutton',
  ComponentBadge = 'component/badge',
  ComponentDialog = 'component/dialog',
  ComponentNavigation = 'component/navigation',
  ComponentAlert = 'component/alert',
  ComponentDivider = 'component/divider',
  ComponentToast = 'component/toast',
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
  {
    name: GalleryRoutes.ComponentNavigation,
    component: DemoRootApp,
    options: { headerShown: false },
  },
  { name: GalleryRoutes.ComponentAlert, component: AlertGallery },
  { name: GalleryRoutes.ComponentDivider, component: DividerGallery },
];

const DevStack = createNativeStackNavigator();

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
