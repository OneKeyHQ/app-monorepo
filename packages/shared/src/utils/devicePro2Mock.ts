import type { EDeviceType } from '@onekeyfe/hd-shared';

// MOCK(pro2): the pinned `@onekeyfe/hd-shared` (alpha.4) has no `EDeviceType.Pro2`
// member yet — it ships in a later SDK version (already present on the
// `feat/pro2-usb-ble` branch's alpha.40 bump). OneKey Pro 2 also can't connect to
// the App yet, so its whole onboarding is a mock.
//
// This single shared constant stands in for the future `EDeviceType.Pro2 = 'pro2'`
// so the mock has ONE searchable identity across `@onekeyhq/kit` (PickYourDevice
// card, ConnectYourDevice video/label) and `@onekeyhq/shared` (wallet avatars),
// instead of masquerading as `EDeviceType.Pro`.
//
// Convergence (see docs/design-specs + memory pro2-onboarding-mock): when
// `@onekeyhq/shared` bumps `hd-shared` to a version that has Pro2, delete this
// file and replace every `MOCK_PRO2_DEVICE_TYPE` usage with `EDeviceType.Pro2`.
//
// A `MOCK(pro2)` search finds the tagged sites, but the swap ALSO touches a few
// UNtagged spots a text search won't surface:
//   - `@onekeyfe/hd-core`'s `IDeviceType` union excludes Pro2, so the SDK bump
//     must widen it too; otherwise `IDeviceType` consumers (e.g.
//     `getDeviceAvatarImage`) still need casts.
//   - `deviceUtils.defaultLabelsByDeviceType` is a parallel device-type -> label
//     map (`Record<IOneKeyDeviceType, string>`) with no Pro2 entry; it becomes a
//     compile error once `IDeviceType` gains Pro2 (good: the compiler forces it).
//   - device-grouping lists in `deviceUtils` (e.g. `isTouchDevice`) — review
//     whether Pro2 belongs in any of them.
export const MOCK_PRO2_DEVICE_TYPE = 'pro2' as unknown as EDeviceType;
