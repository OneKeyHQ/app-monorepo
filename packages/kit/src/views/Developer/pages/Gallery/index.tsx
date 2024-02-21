import type { ComponentType } from 'react';

import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

import { EGalleryRoutes } from '../routes';

const ComponentsScreen = LazyLoad(
  () => import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components'),
);
const AccountModelGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/AccountModelGallery'
    ),
);
const ActionListGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/ActionList'
    ),
);
const AlertGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Alert'
    ),
);
const BadgeGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Badge'
    ),
);
const BlurViewGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/BlurView'
    ),
);
const ButtonGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Button'
    ),
);
const CheckboxGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Checkbox'
    ),
);
const DialogGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Dialog'
    ),
);
const DividerGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Divider'
    ),
);
const EmptyGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Empty'
    ),
);
const ErrorToastGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/ErrorToastGallery'
    ),
);
const FormGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Form'
    ),
);
const HardwareGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Hardware'
    ),
);
const IconGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Icon'
    ),
);
const IconButtonGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/IconButton'
    ),
);
const ImageGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Image'
    ),
);
const InputGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Input'
    ),
);
const JotaiContextGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/JotaiContextGallery'
    ),
);
const JotaiGlobalGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/JotaiGlobalGallery'
    ),
);
const LinearGradientGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/LinearGradient'
    ),
);
const ListItemGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/ListItem'
    ),
);
const ListViewGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/ListView'
    ),
);
const AccountAvatarGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/AccountAvatar'
    ),
);
const WalletAvatarGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/WalletAvatar'
    ),
);
const LocalDBGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/LocalDBGallery'
    ),
);
const LottieViewGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/LottieView'
    ),
);
const DemoRootApp = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/NavigatorRoute'
    ),
);
const PasswordDemoGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/PasswordDemo'
    ),
);
const PopoverGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Popover'
    ),
);
const ProgressGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Progress'
    ),
);
const QRCodeGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/QRCode'
    ),
);
const RadioGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Radio'
    ),
);
const RefreshControlGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/RefreshControl'
    ),
);
const ScanQrCodeGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/ScanQrCode'
    ),
);
const ScrollViewGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/ScrollView'
    ),
);
const SectionListGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/SectionList'
    ),
);
const SegmentControlGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/SegmentControl'
    ),
);
const SelectGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Select'
    ),
);
const ShortcutGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Shortcut'
    ),
);
const SkeletonGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Skeleton'
    ),
);
const SliderGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Slider'
    ),
);
const SortableListViewGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/SortableListView'
    ),
);
const SortableSectionListGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/SortableSectionList'
    ),
);
const SpotlightTourGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/SpotlightTour'
    ),
);
const SwipeableCellGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/SwipeableCell'
    ),
);
const SwitchGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Switch'
    ),
);
const TabViewGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/TabView'
    ),
);
const TextAreaGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/TextArea'
    ),
);
const ToastGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Toast'
    ),
);
const TooltipGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Tooltip'
    ),
);
const TypographyGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Typography'
    ),
);
const WebviewGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/WebView'
    ),
);
const AddressInputGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/AddressInput'
    ),
);

const SwiperGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Swiper'
    ),
);

const PortalGallery = LazyLoad(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Portal'
    ),
);

export const galleryScreenList: {
  name: EGalleryRoutes;
  component: ComponentType;
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
  {
    name: EGalleryRoutes.ComponentPortal,
    component: PortalGallery,
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
  {
    name: EGalleryRoutes.ComponentAccountAvatar,
    component: AccountAvatarGallery,
  },
  {
    name: EGalleryRoutes.ComponentWalletAvatar,
    component: WalletAvatarGallery,
  },
  { name: EGalleryRoutes.ComponentSectionList, component: SectionListGallery },
  { name: EGalleryRoutes.ComponentSwiper, component: SwiperGallery },
  {
    name: EGalleryRoutes.ComponentSortableListView,
    component: SortableListViewGallery,
  },
  {
    name: EGalleryRoutes.ComponentSwipeableCell,
    component: SwipeableCellGallery,
  },
  {
    name: EGalleryRoutes.ComponentSpotlightTour,
    component: SpotlightTourGallery,
  },
  {
    name: EGalleryRoutes.ComponentSortableSectionList,
    component: SortableSectionListGallery,
  },
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
    name: EGalleryRoutes.componentScanQrCode,
    component: ScanQrCodeGallery,
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
  {
    name: EGalleryRoutes.ComponentLinearGradientGallery,
    component: LinearGradientGallery,
  },
  {
    name: EGalleryRoutes.ComponentAccountModel,
    component: AccountModelGallery,
  },
  {
    name: EGalleryRoutes.ComponentHardware,
    component: HardwareGallery,
  },
  {
    name: EGalleryRoutes.ComponentImage,
    component: ImageGallery,
  },
  {
    name: EGalleryRoutes.ComponentAddressInput,
    component: AddressInputGallery,
  },
];
