import React from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';

import { useThemeValue } from '@onekeyhq/components';
import ComponentsScreen from '@onekeyhq/kit/src/views/Components';
import AccountGallery from '@onekeyhq/kit/src/views/Components/stories/Account';
import AddressGallery from '@onekeyhq/kit/src/views/Components/stories/Address';
import AlertGallery from '@onekeyhq/kit/src/views/Components/stories/Alert';
import AvatarGallery from '@onekeyhq/kit/src/views/Components/stories/Avatar';
import BadgeGallery from '@onekeyhq/kit/src/views/Components/stories/Badge';
import ButtonsGallery from '@onekeyhq/kit/src/views/Components/stories/Buttons';
import CheckBoxGallery from '@onekeyhq/kit/src/views/Components/stories/CheckBox';
import DappModalsGallery from '@onekeyhq/kit/src/views/Components/stories/DappModals';
import DialogGallery from '@onekeyhq/kit/src/views/Components/stories/Dialog';
import EmojiGallery from '@onekeyhq/kit/src/views/Components/stories/Emoji';
import EmptyGallery from '@onekeyhq/kit/src/views/Components/stories/Empty';
import FormGallery from '@onekeyhq/kit/src/views/Components/stories/Form';
import HeaderTabViewContainerGallery from '@onekeyhq/kit/src/views/Components/stories/HeaderTabViewContainer';
import IconGallery from '@onekeyhq/kit/src/views/Components/stories/Icon';
import IconButtons from '@onekeyhq/kit/src/views/Components/stories/IconButtons';
import ImageViewerGallery from '@onekeyhq/kit/src/views/Components/stories/ImageViewer';
import InputGallery from '@onekeyhq/kit/src/views/Components/stories/Input';
import LoggerGallery from '@onekeyhq/kit/src/views/Components/stories/Logger';
import MarkdownGallery from '@onekeyhq/kit/src/views/Components/stories/Markdown';
import ModalGallery from '@onekeyhq/kit/src/views/Components/stories/Modal';
import NftCardGallery from '@onekeyhq/kit/src/views/Components/stories/NftCard';
import PageActionsGallery from '@onekeyhq/kit/src/views/Components/stories/PageActions';
import PinCodeGallery from '@onekeyhq/kit/src/views/Components/stories/PinCode';
import QRCodeGallery from '@onekeyhq/kit/src/views/Components/stories/QRCode';
import RadioGallery from '@onekeyhq/kit/src/views/Components/stories/Radio';
import RadioBoxGallery from '@onekeyhq/kit/src/views/Components/stories/RadioBox';
import RestfulRequest from '@onekeyhq/kit/src/views/Components/stories/RestfulRequest';
import SearchbarGallery from '@onekeyhq/kit/src/views/Components/stories/Searchbar';
import SegmentedControl from '@onekeyhq/kit/src/views/Components/stories/SegmentedControl';
import SelectGallery from '@onekeyhq/kit/src/views/Components/stories/Select';
import ShadowsGallery from '@onekeyhq/kit/src/views/Components/stories/Shadows';
import SortableListGallery from '@onekeyhq/kit/src/views/Components/stories/SortableList';
import SpinnerGallery from '@onekeyhq/kit/src/views/Components/stories/Spinner';
import SwitchGallery from '@onekeyhq/kit/src/views/Components/stories/Switch';
import TabsGallery from '@onekeyhq/kit/src/views/Components/stories/Tabs';
import TextareaGallery from '@onekeyhq/kit/src/views/Components/stories/Textarea';
import ThemeGallery from '@onekeyhq/kit/src/views/Components/stories/Theme';
import ToastGallery from '@onekeyhq/kit/src/views/Components/stories/Toast';
import TokenGallery from '@onekeyhq/kit/src/views/Components/stories/Token';
import TypographyGallery from '@onekeyhq/kit/src/views/Components/stories/Typography';
import WebViewGallery from '@onekeyhq/kit/src/views/Components/stories/WebView';

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
  ComponentToken = 'component/token',
  ComponentTheme = 'component/theme',
  ComponentIcon = 'component/icon',
  ComponentBadge = 'component/badge',
  ComponentAlert = 'component/alert',
  ComponentButton = 'component/button',
  ComponentIconButton = 'component/icon-button',
  ComponentSelect = 'component/select',
  ComponentShadow = 'component/shadow',
  ComponentEmpty = 'component/empty',
  ComponentToast = 'component/toast',
  ComponentAccount = 'component/account',
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
  ComponentHeaderTabViewContainerGallery = 'component/header-tab-view',
  ComponentLogger = 'component/logger',
  ComponentWebview = 'component/webview',
  ComponentPinCode = 'component/pincode',
  ComponentRestfulRequest = 'component/restful-request',
  ComponentImageViewer = 'component/imageViewer',
  ComponentEmojiList = 'component/EmojiList',
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
  [StackRoutes.ComponentAlert]: undefined;
  [StackRoutes.ComponentButton]: undefined;
  [StackRoutes.ComponentIconButton]: undefined;
  [StackRoutes.ComponentSelect]: undefined;
  [StackRoutes.ComponentShadow]: undefined;
  [StackRoutes.ComponentEmpty]: undefined;
  [StackRoutes.ComponentToast]: undefined;
  [StackRoutes.ComponentAccount]: undefined;
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
  [StackRoutes.ComponentHeaderTabViewContainerGallery]: undefined;
  [StackRoutes.ComponentLogger]: undefined;
  [StackRoutes.ComponentWebview]: undefined;
  [StackRoutes.ComponentPinCode]: undefined;
  [StackRoutes.ComponentRestfulRequest]: undefined;
  [StackRoutes.ComponentImageViewer]: undefined;
  [StackRoutes.ComponentEmojiList]: undefined;
};

export const stackScreenList = [
  { name: StackRoutes.Developer, component: ComponentsScreen },
  { name: StackRoutes.ComponentTextarea, component: TextareaGallery },
  { name: StackRoutes.ComponentSearchBar, component: SearchbarGallery },
  { name: StackRoutes.ComponentAddress, component: AddressGallery },
  { name: StackRoutes.ComponentInput, component: InputGallery },
  { name: StackRoutes.ComponentCard, component: NftCardGallery },
  { name: StackRoutes.ComponentDappModals, component: DappModalsGallery },
  { name: StackRoutes.ComponentAvatar, component: AvatarGallery },
  { name: StackRoutes.ComponentTypography, component: TypographyGallery },
  { name: StackRoutes.ComponentToken, component: TokenGallery },
  { name: StackRoutes.ComponentTheme, component: ThemeGallery },
  { name: StackRoutes.ComponentIcon, component: IconGallery },
  { name: StackRoutes.ComponentBadge, component: BadgeGallery },
  { name: StackRoutes.ComponentAlert, component: AlertGallery },
  { name: StackRoutes.ComponentButton, component: ButtonsGallery },
  { name: StackRoutes.ComponentIconButton, component: IconButtons },
  { name: StackRoutes.ComponentSelect, component: SelectGallery },
  { name: StackRoutes.ComponentEmpty, component: EmptyGallery },
  { name: StackRoutes.ComponentToast, component: ToastGallery },
  { name: StackRoutes.ComponentAccount, component: AccountGallery },
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
  { name: StackRoutes.ComponentRestfulRequest, component: RestfulRequest },
  {
    name: StackRoutes.ComponentHeaderTabViewContainerGallery,
    component: HeaderTabViewContainerGallery,
  },
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
          header:
            Platform.OS === 'ios' ? renderCustomSubStackHeader : undefined,
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
