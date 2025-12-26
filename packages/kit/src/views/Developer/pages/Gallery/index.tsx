import type { ComponentType } from 'react';

import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import { EGalleryRoutes } from '@onekeyhq/shared/src/routes';

const AnchorGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Anchor'
    ),
);
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
const BreadcrumbGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/BreadcrumbGallery'
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
const DiscoveryBrowserGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/DiscoveryBrowserGallery'
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

const SendGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/SendGallery'
    ),
);

const ErrorToastGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/ErrorToastGallery'
    ),
);

const FirmwareUpdateGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/FirmwareUpdateGallery'
    ),
);

const QRWalletGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/QRWalletGallery'
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
const IpRequestGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/IpRequest'
    ),
);
const NetworkDoctorGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/NetworkDoctor'
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
const SecureQRToastGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/SecureQRToast'
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
const SegmentSliderGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/SegmentSlider'
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
const SpotlightGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Spotlight'
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
const TableGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/TableGallery/index'
    ),
);
const NewTabsGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/NewTabsGallery'
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

const NumberSizeableTextGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/NumberSizeableTextGallery'
    ),
);

const OrderBookGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/OrderBookGallery'
    ),
);

const TokenGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Token'
    ),
);

const LoggerGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Logger'
    ),
);

const ChainSelectorGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/ChainSelector'
    ),
);

const MarkdownGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Markdown'
    ),
);

const NetworkStatusBadgeGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/NetworkStatusBadge'
    ),
);

const NotificationGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/NotificationGallery'
    ),
);

const WebEmbedGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/WebEmbed'
    ),
);

const DotMapGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/DotMap'
    ),
);

const UsePromiseResultGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/UsePromiseResult'
    ),
);

const ImageCropGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/ImageCrop'
    ),
);

const CurrencyGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Currency'
    ),
);

const PasswordKeyboardGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/PasswordKeyboard'
    ),
);

const PerpGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/PerpGallery'
    ),
);

const CloudBackupGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/CloudBackupGallery'
    ),
);

const KeylessWalletGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/KeylessWalletGallery'
    ),
);

const TradingViewGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/TradingView'
    ),
);

const TradingViewPerpsV2Gallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/TradingViewPerpsV2'
    ),
);

const LetterAvatarGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/LetterAvatar'
    ),
);

const SignatureConfirmationGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/SignatureConfirmation'
    ),
);

const HyperlinkTextGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/HyperlinkTextGallery'
    ),
);
const HapticsGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Haptics'
    ),
);

const AccordionGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/AccordionGallery'
    ),
);

const AuthGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/AuthGallery'
    ),
);

const OneKeyIDGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/OneKeyIDGallery'
    ),
);

const OTPInputGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/OTPInputGallery'
    ),
);

const RichSizeableTextGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/RichSizeableText'
    ),
);

const BannerGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Banner/Banner'
    ),
);

const StepperGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Stepper'
    ),
);

const ThemeColorsGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/ThemeColors'
    ),
);

const PaginationGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Pagination'
    ),
);

const CountDownCalendarAlertGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/CountDownCalendarAlert'
    ),
);

const TriggerGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Trigger'
    ),
);

const TutorialsListGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/TutorialsList'
    ),
);

const OrderedListGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/OrderedList'
    ),
);

const RestartGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Restart'
    ),
);

const FontGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Font'
    ),
);

const CryptoGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/CryptoGallery'
    ),
);

const UnOrderedListGallery = LazyLoadPage(
  () => import('./Components/stories/UnOrderedListGallery'),
);

const CarouselGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Carousel'
    ),
);

const PlaygroundGallery = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/playground/index'
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
  {
    name: EGalleryRoutes.ComponentToken,
    component: TokenGallery,
  },
  { name: EGalleryRoutes.ComponentIcon, component: IconGallery },
  { name: EGalleryRoutes.ComponentToast, component: ToastGallery },
  { name: EGalleryRoutes.ComponentShortcut, component: ShortcutGallery },
  { name: EGalleryRoutes.ComponentSelect, component: SelectGallery },
  { name: EGalleryRoutes.ComponentTooltip, component: TooltipGallery },
  { name: EGalleryRoutes.ComponentTrigger, component: TriggerGallery },
  {
    name: EGalleryRoutes.ComponentTutorialsList,
    component: TutorialsListGallery,
  },
  { name: EGalleryRoutes.ComponentOrderedList, component: OrderedListGallery },
  { name: EGalleryRoutes.ComponentBadge, component: BadgeGallery },
  { name: EGalleryRoutes.ComponentBreadcrumb, component: BreadcrumbGallery },
  { name: EGalleryRoutes.ComponentInput, component: InputGallery },
  { name: EGalleryRoutes.ComponentIpRequest, component: IpRequestGallery },
  {
    name: EGalleryRoutes.ComponentNetworkDoctor,
    component: NetworkDoctorGallery,
  },
  { name: EGalleryRoutes.ComponentDialog, component: DialogGallery },
  { name: EGalleryRoutes.ComponentEmpty, component: EmptyGallery },
  { name: EGalleryRoutes.ComponentSend, component: SendGallery },
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
    name: EGalleryRoutes.ComponentSpotlight,
    component: SpotlightGallery,
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
  {
    name: EGalleryRoutes.ComponentNumberSizeableTextGallery,
    component: NumberSizeableTextGallery,
  },
  { name: EGalleryRoutes.ComponentSwitch, component: SwitchGallery },
  { name: EGalleryRoutes.ComponentTable, component: TableGallery },
  { name: EGalleryRoutes.ComponentButton, component: ButtonGallery },
  { name: EGalleryRoutes.ComponentTextArea, component: TextAreaGallery },
  { name: EGalleryRoutes.ComponentSlider, component: SliderGallery },
  {
    name: EGalleryRoutes.ComponentSegmentSlider,
    component: SegmentSliderGallery,
  },
  {
    name: EGalleryRoutes.ComponentSegmentControl,
    component: SegmentControlGallery,
  },
  { name: EGalleryRoutes.ComponentAlert, component: AlertGallery },
  {
    name: EGalleryRoutes.ComponentDiscoveryBrowser,
    component: DiscoveryBrowserGallery,
  },
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
    name: EGalleryRoutes.ComponentFirmwareUpdate,
    component: FirmwareUpdateGallery,
  },
  {
    name: EGalleryRoutes.ComponentQRWallet,
    component: QRWalletGallery,
  },
  {
    name: EGalleryRoutes.ComponentForm,
    component: FormGallery,
  },
  {
    name: EGalleryRoutes.ComponentNewTabs,
    component: NewTabsGallery,
  },
  {
    name: EGalleryRoutes.ComponentQRCode,
    component: QRCodeGallery,
  },
  {
    name: EGalleryRoutes.ComponentSecureQRToast,
    component: SecureQRToastGallery,
  },
  {
    name: EGalleryRoutes.ComponentScanQrCode,
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
  {
    name: EGalleryRoutes.ComponentLogger,
    component: LoggerGallery,
  },
  {
    name: EGalleryRoutes.ComponentChainSelector,
    component: ChainSelectorGallery,
  },
  {
    name: EGalleryRoutes.ComponentMarkdown,
    component: MarkdownGallery,
  },
  {
    name: EGalleryRoutes.ComponentNetworkStatusBadge,
    component: NetworkStatusBadgeGallery,
  },
  {
    name: EGalleryRoutes.ComponentNotification,
    component: NotificationGallery,
  },
  {
    name: EGalleryRoutes.ComponentWebEmbed,
    component: WebEmbedGallery,
  },
  {
    name: EGalleryRoutes.ComponentDotMap,
    component: DotMapGallery,
  },
  {
    name: EGalleryRoutes.ComponentUsePromiseResult,
    component: UsePromiseResultGallery,
  },
  {
    name: EGalleryRoutes.ComponentImageCropGallery,
    component: ImageCropGallery,
  },
  {
    name: EGalleryRoutes.ComponentCurrency,
    component: CurrencyGallery,
  },
  {
    name: EGalleryRoutes.ComponentPasswordKeyboardGallery,
    component: PasswordKeyboardGallery,
  },
  {
    name: EGalleryRoutes.ComponentPerp,
    component: PerpGallery,
  },
  {
    name: EGalleryRoutes.ComponentCloudBackup,
    component: CloudBackupGallery,
  },
  {
    name: EGalleryRoutes.ComponentKeylessWallet,
    component: KeylessWalletGallery,
  },
  {
    name: EGalleryRoutes.ComponentOrderBook,
    component: OrderBookGallery,
  },
  {
    name: EGalleryRoutes.ComponentTradingViewGallery,
    component: TradingViewGallery,
  },
  {
    name: EGalleryRoutes.ComponentTradingViewPerpsV2Gallery,
    component: TradingViewPerpsV2Gallery,
  },
  {
    name: EGalleryRoutes.LetterAvatarGallery,
    component: LetterAvatarGallery,
  },
  {
    name: EGalleryRoutes.SignatureConfirmationGallery,
    component: SignatureConfirmationGallery,
  },
  {
    name: EGalleryRoutes.HyperlinkTextGallery,
    component: HyperlinkTextGallery,
  },
  {
    name: EGalleryRoutes.HapticsGallery,
    component: HapticsGallery,
  },
  {
    name: EGalleryRoutes.ComponentAccordion,
    component: AccordionGallery,
  },
  {
    name: EGalleryRoutes.ComponentOTPInput,
    component: OTPInputGallery,
  },
  {
    name: EGalleryRoutes.ComponentRichSizeableText,
    component: RichSizeableTextGallery,
  },
  {
    name: EGalleryRoutes.ComponentBanner,
    component: BannerGallery,
  },
  {
    name: EGalleryRoutes.ComponentStepper,
    component: StepperGallery,
  },
  {
    name: EGalleryRoutes.CountDownCalendarAlert,
    component: CountDownCalendarAlertGallery,
  },
  {
    name: EGalleryRoutes.ComponentThemeColors,
    component: ThemeColorsGallery,
  },
  { name: EGalleryRoutes.ComponentAnchor, component: AnchorGallery },
  {
    name: EGalleryRoutes.ComponentPagination,
    component: PaginationGallery,
  },
  {
    name: EGalleryRoutes.ComponentRestart,
    component: RestartGallery,
  },
  {
    name: EGalleryRoutes.FontGallery,
    component: FontGallery,
  },
  {
    name: EGalleryRoutes.ComponentCryptoGallery,
    component: CryptoGallery,
  },
  {
    name: EGalleryRoutes.ComponentUnOrderedList,
    component: UnOrderedListGallery,
  },
  {
    name: EGalleryRoutes.ComponentCarousel,
    component: CarouselGallery,
  },
  {
    name: EGalleryRoutes.ComponentPlayground,
    component: PlaygroundGallery,
  },
  {
    name: EGalleryRoutes.ComponentAuth,
    component: AuthGallery,
  },
  {
    name: EGalleryRoutes.ComponentOneKeyID,
    component: OneKeyIDGallery,
  },
];
