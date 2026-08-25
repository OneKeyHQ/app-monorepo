import type { ComponentType } from 'react';

import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import { EGalleryRoutes } from '@onekeyhq/shared/src/routes';

const ComponentsScreen = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components'),
);
const AccountModelGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/AccountModelGallery'),
);
const DiscoveryBrowserGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/DiscoveryBrowserGallery'),
);
const SendGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/SendGallery'),
);

const ErrorToastGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/ErrorToastGallery'),
);

const FirmwareArtifactGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/FirmwareArtifactGallery'),
);

const QRWalletGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/QRWalletGallery'),
);

const HardwareGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Hardware'),
);
const DeviceStageDriverGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/DeviceStageDriverGallery'),
);
const LedgerAppOpsGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/LedgerAppOps'),
);
const TrezorMultiTransportGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/TrezorMultiTransport'),
);
const ThirdPartyHardwareActionsGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/ThirdPartyHardwareActions'),
);
const IpRequestGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/IpRequest'),
);
const NetworkDoctorGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/NetworkDoctor'),
);
const JotaiContextGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/JotaiContextGallery'),
);
const JotaiGlobalGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/JotaiGlobalGallery'),
);
const LightweightChartStyleGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/LightweightChartStyle'),
);
const ListItemGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/ListItem'),
);
const AccountAvatarGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/AccountAvatar'),
);
const WalletAvatarGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/WalletAvatar'),
);
const LocalDBGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/LocalDBGallery'),
);

const PasswordDemoGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/PasswordDemo'),
);
const SecureQRToastGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/SecureQRToast'),
);
const RefreshControlGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/RefreshControl'),
);
const RookieGuideGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/RookieGuideGallery'),
);
const ScanQrCodeGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/ScanQrCode'),
);
const SetupStepItemGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/SetupStepItem'),
);
const ShortcutGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Shortcut'),
);
const SpotlightGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Spotlight'),
);
const NewTabsGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/NewTabsGallery'),
);
const TypographyGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Typography'),
);
const WebviewGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/WebView'),
);
const WebViewOverlayGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/WebViewOverlay'),
);
const AddressInputGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/AddressInput'),
);

const PortalGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Portal'),
);

const AmountInputGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/AmountInput'),
);

const OrderBookGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/OrderBookGallery'),
);

const TokenGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Token'),
);

const LoggerGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Logger'),
);

const ChainSelectorGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/ChainSelector'),
);

const NotificationGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/NotificationGallery'),
);

const WebEmbedGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/WebEmbed'),
);

const DotMapGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/DotMap'),
);

const UsePromiseResultGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/UsePromiseResult'),
);

const ImageCropGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/ImageCrop'),
);

const CurrencyGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Currency'),
);

const PasswordKeyboardGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/PasswordKeyboard'),
);

const PerpGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/PerpGallery'),
);

const UnifoldDepositGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/UnifoldDepositGallery'),
);

const CloudBackupGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/CloudBackupGallery'),
);

const CloudSyncGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/CloudSyncGallery'),
);

const TradingViewGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/TradingView'),
);

const TradingViewV2Gallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/TradingViewV2'),
);

const TradingViewPerpsV2Gallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/TradingViewPerpsV2'),
);

const LetterAvatarGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/LetterAvatar'),
);

const SignatureConfirmationGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/SignatureConfirmation'),
);

const HyperlinkTextGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/HyperlinkTextGallery'),
);

const AuthGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/AuthGallery'),
);

const OneKeyIDGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/OneKeyIDGallery'),
);

const StorageGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/StorageGallery'),
);

const RichSizeableTextGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/RichSizeableText'),
);

const ThemeColorsGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/ThemeColors'),
);

const CountDownCalendarAlertGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/CountDownCalendarAlert'),
);

const TutorialsListGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/TutorialsList'),
);

const OrderedListGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/OrderedList'),
);

const RestartGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Restart'),
);

const FontGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/Font'),
);

const CryptoGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/CryptoGallery'),
);

const PlaygroundGallery = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Developer/pages/Gallery/Components/stories/playground/index'),
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
    name: EGalleryRoutes.ComponentPortal,
    component: PortalGallery,
  },
  {
    name: EGalleryRoutes.ComponentToken,
    component: TokenGallery,
  },
  { name: EGalleryRoutes.ComponentShortcut, component: ShortcutGallery },
  {
    name: EGalleryRoutes.ComponentTutorialsList,
    component: TutorialsListGallery,
  },
  { name: EGalleryRoutes.ComponentOrderedList, component: OrderedListGallery },
  { name: EGalleryRoutes.ComponentIpRequest, component: IpRequestGallery },
  {
    name: EGalleryRoutes.ComponentNetworkDoctor,
    component: NetworkDoctorGallery,
  },
  { name: EGalleryRoutes.ComponentSend, component: SendGallery },
  {
    name: EGalleryRoutes.ComponentAccountAvatar,
    component: AccountAvatarGallery,
  },
  {
    name: EGalleryRoutes.ComponentWalletAvatar,
    component: WalletAvatarGallery,
  },
  {
    name: EGalleryRoutes.ComponentAmountInput,
    component: AmountInputGallery,
  },
  {
    name: EGalleryRoutes.ComponentSpotlight,
    component: SpotlightGallery,
  },
  { name: EGalleryRoutes.ComponentListItem, component: ListItemGallery },
  {
    name: EGalleryRoutes.ComponentPasswordDemo,
    component: PasswordDemoGallery,
  },
  {
    name: EGalleryRoutes.ComponentSetupStepItem,
    component: SetupStepItemGallery,
  },
  {
    name: EGalleryRoutes.ComponentDiscoveryBrowser,
    component: DiscoveryBrowserGallery,
  },
  {
    name: EGalleryRoutes.ComponentJotaiContext,
    component: JotaiContextGallery,
  },
  { name: EGalleryRoutes.ComponentJotaiGlobal, component: JotaiGlobalGallery },
  { name: EGalleryRoutes.ComponentLocalDB, component: LocalDBGallery },
  { name: EGalleryRoutes.ComponentErrorToast, component: ErrorToastGallery },
  {
    name: EGalleryRoutes.ComponentFirmwareArtifact,
    component: FirmwareArtifactGallery,
  },
  {
    name: EGalleryRoutes.ComponentQRWallet,
    component: QRWalletGallery,
  },
  {
    name: EGalleryRoutes.ComponentNewTabs,
    component: NewTabsGallery,
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
    name: EGalleryRoutes.ComponentWebViewOverlay,
    component: WebViewOverlayGallery,
  },
  {
    name: EGalleryRoutes.ComponentRefreshControl,
    component: RefreshControlGallery,
  },
  {
    name: EGalleryRoutes.ComponentRookieGuide,
    component: RookieGuideGallery,
  },
  {
    name: EGalleryRoutes.ComponentLightweightChartStyle,
    component: LightweightChartStyleGallery,
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
    name: EGalleryRoutes.ComponentDeviceStageDriver,
    component: DeviceStageDriverGallery,
  },
  {
    name: EGalleryRoutes.ComponentLedgerAppOps,
    component: LedgerAppOpsGallery,
  },
  {
    name: EGalleryRoutes.ComponentTrezorMultiTransport,
    component: TrezorMultiTransportGallery,
  },
  {
    name: EGalleryRoutes.ComponentThirdPartyHardwareActions,
    component: ThirdPartyHardwareActionsGallery,
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
    name: EGalleryRoutes.ComponentUnifoldDeposit,
    component: UnifoldDepositGallery,
  },
  {
    name: EGalleryRoutes.ComponentCloudBackup,
    component: CloudBackupGallery,
  },
  {
    name: EGalleryRoutes.ComponentCloudSync,
    component: CloudSyncGallery,
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
    name: EGalleryRoutes.ComponentTradingViewV2Gallery,
    component: TradingViewV2Gallery,
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
    name: EGalleryRoutes.ComponentRichSizeableText,
    component: RichSizeableTextGallery,
  },
  {
    name: EGalleryRoutes.CountDownCalendarAlert,
    component: CountDownCalendarAlertGallery,
  },
  {
    name: EGalleryRoutes.ComponentThemeColors,
    component: ThemeColorsGallery,
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
  {
    name: EGalleryRoutes.ComponentStorage,
    component: StorageGallery,
  },
];
