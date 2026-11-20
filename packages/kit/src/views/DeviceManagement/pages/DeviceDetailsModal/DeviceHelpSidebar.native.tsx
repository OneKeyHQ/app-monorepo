import type { IDeviceHelpTroubleshooting } from './DeviceHelpPanel';

// The help sidebar needs a wide window; native screens use the
// troubleshooting row in the page instead.
export function DeviceHelpSidebar(_props: {
  placeholder?: boolean;
  troubleshooting?: IDeviceHelpTroubleshooting;
}) {
  return null;
}
