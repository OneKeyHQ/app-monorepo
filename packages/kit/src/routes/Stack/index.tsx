import React, { ComponentType } from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ICON_NAMES, Layout } from '@onekeyhq/components';
import LayoutHeader from '@onekeyhq/components/src/Layout/Header';
import AccountSelector from '@onekeyhq/kit/src/components/Header/AccountSelector';
import ChainSelector from '@onekeyhq/kit/src/components/Header/ChainSelector';
import ApprovalScreen from '@onekeyhq/kit/src/views/Approval';
import ComponentsScreen from '@onekeyhq/kit/src/views/Components';
import AccountGallery from '@onekeyhq/kit/src/views/Components/stories/Account';
import AddressGallery from '@onekeyhq/kit/src/views/Components/stories/Address';
import AlertGallery from '@onekeyhq/kit/src/views/Components/stories/Alert';
import AvatarGallery from '@onekeyhq/kit/src/views/Components/stories/Avatar';
import BadgeGallery from '@onekeyhq/kit/src/views/Components/stories/Badge';
import ButtonsGallery from '@onekeyhq/kit/src/views/Components/stories/Buttons';
import CheckBoxGallery from '@onekeyhq/kit/src/views/Components/stories/CheckBox';
import DialogGallery from '@onekeyhq/kit/src/views/Components/stories/Dialog';
import EmptyGallery from '@onekeyhq/kit/src/views/Components/stories/Empty';
import FormGallery from '@onekeyhq/kit/src/views/Components/stories/Form';
import HeaderTabViewContainerGallery from '@onekeyhq/kit/src/views/Components/stories/HeaderTabViewContainer';
import IconGallery from '@onekeyhq/kit/src/views/Components/stories/Icon';
import IconButtons from '@onekeyhq/kit/src/views/Components/stories/IconButtons';
import InputGallery from '@onekeyhq/kit/src/views/Components/stories/Input';
import LoggerGallery from '@onekeyhq/kit/src/views/Components/stories/Logger';
import MarkdownGallery from '@onekeyhq/kit/src/views/Components/stories/Markdown';
import ModalGallery from '@onekeyhq/kit/src/views/Components/stories/Modal';
import NftCardGallery from '@onekeyhq/kit/src/views/Components/stories/NftCard';
import PageActionsGallery from '@onekeyhq/kit/src/views/Components/stories/PageActions';
import QRCodeGallery from '@onekeyhq/kit/src/views/Components/stories/QRCode';
import RadioGallery from '@onekeyhq/kit/src/views/Components/stories/Radio';
import RadioBoxGallery from '@onekeyhq/kit/src/views/Components/stories/RadioBox';
import ReduxMessageGallery from '@onekeyhq/kit/src/views/Components/stories/ReduxMessage';
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
import DiscoverScreen from '@onekeyhq/kit/src/views/Discover';
import MeScreen from '@onekeyhq/kit/src/views/Me';
import PortfolioScreen from '@onekeyhq/kit/src/views/Portfolio';
import SwapScreen from '@onekeyhq/kit/src/views/Swap';
import TokenDetail from '@onekeyhq/kit/src/views/TokenDetail';
import HomeScreen from '@onekeyhq/kit/src/views/Wallet';

export enum TabRoutes {
  Home = 'home',
  Swap = 'swap',
  Portfolio = 'portfolio',
  Discover = 'discover',
  Me = 'me',
}

export type TabRoutesParams = {
  [key in TabRoutes]: undefined;
};

export enum StackBasicRoutes {
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
  ComponentPageActions = 'component/page-actions',
  ComponentSortableList = 'component/sortable-list',
  ComponentTabs = 'component/tabs',
  ComponentSegmentedControl = 'component/segmented-control',
  ComponentReduxMessage = 'component/redux-message',
  ComponentHeaderTabViewContainerGallery = 'component/header-tab-view',
  ComponentLogger = 'component/logger',
  ComponentWebview = 'component/webview',
  ScreenTokenDetail = 'TokenDetailScreen',
}

export type StackBasicRoutesParams = {
  [key in StackBasicRoutes]: undefined;
};

export const StackRoutes = { ...TabRoutes, ...StackBasicRoutes };
export type StackRoutesParams = TabRoutesParams & StackBasicRoutesParams;

type TabRoute = {
  icon: ICON_NAMES;
  name: typeof StackRoutes[keyof typeof StackRoutes];
  translationId: string;
  component: ComponentType;
};

export const tabRoutes: TabRoute[] = [
  {
    name: StackRoutes.Home,
    component: HomeScreen,
    icon: 'HomeOutline',
    translationId: 'title__home',
  },
  {
    name: StackRoutes.Swap,
    component: SwapScreen,
    icon: 'SwitchHorizontalOutline',
    translationId: 'title__swap',
  },
  {
    name: StackRoutes.Portfolio,
    component: PortfolioScreen,
    icon: 'TrendingUpOutline',
    translationId: 'title__portfolio',
  },
  {
    name: StackRoutes.Discover,
    component: DiscoverScreen,
    icon: 'CompassOutline',
    translationId: 'title__explore',
  },
  {
    name: StackRoutes.Me,
    component: MeScreen,
    icon: 'UserOutline',
    translationId: 'title__me',
  },
];

export const stackScreenList = [
  { name: StackRoutes.Developer, component: ComponentsScreen },
  { name: StackRoutes.ComponentApproval, component: ApprovalScreen },
  { name: StackRoutes.ComponentTextarea, component: TextareaGallery },
  { name: StackRoutes.ComponentSearchBar, component: SearchbarGallery },
  { name: StackRoutes.ComponentAddress, component: AddressGallery },
  { name: StackRoutes.ComponentInput, component: InputGallery },
  { name: StackRoutes.ComponentCard, component: NftCardGallery },
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
  { name: StackRoutes.ComponentReduxMessage, component: ReduxMessageGallery },
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
    name: StackRoutes.ScreenTokenDetail,
    component: TokenDetail,
  },
];

export const StackNavigator = createNativeStackNavigator<StackRoutesParams>();

const StackScreen = () => (
  <StackNavigator.Navigator>
    {tabRoutes.map((tab) => (
      <StackNavigator.Screen
        key={tab.name}
        name={tab.name}
        options={{
          header: () => (
            <LayoutHeader
              headerLeft={() => <AccountSelector />}
              headerRight={() => <ChainSelector />}
            />
          ),
          animation: 'none',
        }}
      >
        {() => (
          <Layout name={tab.name} content={tab.component} tabs={tabRoutes} />
        )}
      </StackNavigator.Screen>
    ))}
    {stackScreenList.map((stack) => (
      <StackNavigator.Screen key={stack.name} name={stack.name}>
        {() => (
          <Layout
            name={stack.name}
            content={stack.component}
            tabs={tabRoutes}
          />
        )}
      </StackNavigator.Screen>
    ))}
  </StackNavigator.Navigator>
);

export default StackScreen;
