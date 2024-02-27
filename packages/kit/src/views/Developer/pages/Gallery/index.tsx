import type { ComponentType } from 'react';

import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';

import { EGalleryRoutes } from '../routes';

const ComponentsScreen = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components'),
);
const AccountModelGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/AccountModelGallery'
    ),
);
const ActionListGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/ActionList'
    ),
);
const AlertGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Alert'
    ),
);
const BadgeGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Badge'
    ),
);
const BlurViewGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/BlurView'
    ),
);
const ButtonGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Button'
    ),
);
const CheckboxGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Checkbox'
    ),
);
const DialogGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Dialog'
    ),
);
const DividerGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Divider'
    ),
);
const EmptyGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Empty'
    ),
);
const ErrorToastGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/ErrorToastGallery'
    ),
);
const FormGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Form'
    ),
);
const HardwareGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Hardware'
    ),
);
const IconGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Icon'
    ),
);
const IconButtonGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/IconButton'
    ),
);
const ImageGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Image'
    ),
);
const InputGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Input'
    ),
);
const JotaiContextGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/JotaiContextGallery'
    ),
);
const JotaiGlobalGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/JotaiGlobalGallery'
    ),
);
const LinearGradientGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/LinearGradient'
    ),
);
const ListItemGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/ListItem'
    ),
);
const ListViewGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/ListView'
    ),
);
const AccountAvatarGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/AccountAvatar'
    ),
);
const WalletAvatarGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/WalletAvatar'
    ),
);
const LocalDBGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/LocalDBGallery'
    ),
);
const LottieViewGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/LottieView'
    ),
);
const DemoRootApp = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/NavigatorRoute'
    ),
);
const PasswordDemoGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/PasswordDemo'
    ),
);
const PopoverGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Popover'
    ),
);
const ProgressGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Progress'
    ),
);
const QRCodeGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/QRCode'
    ),
);
const RadioGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Radio'
    ),
);
const RefreshControlGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/RefreshControl'
    ),
);
const ScanQrCodeGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/ScanQrCode'
    ),
);
const ScrollViewGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/ScrollView'
    ),
);
const SectionListGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/SectionList'
    ),
);
const SegmentControlGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/SegmentControl'
    ),
);
const SelectGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Select'
    ),
);
const ShortcutGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Shortcut'
    ),
);
const SkeletonGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Skeleton'
    ),
);
const SliderGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Slider'
    ),
);
const SortableListViewGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/SortableListView'
    ),
);
const SortableSectionListGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/SortableSectionList'
    ),
);
const SpotlightTourGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/SpotlightTour'
    ),
);
const SwipeableCellGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/SwipeableCell'
    ),
);
const SwitchGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Switch'
    ),
);
const TabViewGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/TabView'
    ),
);
const TextAreaGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/TextArea'
    ),
);
const ToastGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Toast'
    ),
);
const TooltipGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Tooltip'
    ),
);
const TypographyGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Typography'
    ),
);
const WebviewGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/WebView'
    ),
);
const AddressInputGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/AddressInput'
    ),
);

const SwiperGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Swiper'
    ),
);

const PortalGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Portal'
    ),
);

const AmountInputGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/AmountInput'
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
    name: EGalleryRoutes.ComponentAmountInput,
    component: AmountInputGallery,
  },
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
