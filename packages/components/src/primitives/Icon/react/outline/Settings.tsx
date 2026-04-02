import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSettings = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="m15.148 4.57 2.252-.52.54-.124.392.392 1.35 1.35.392.392-.644 2.79L22 10.566v2.87l-2.57 1.713.644 2.792-.392.392-1.35 1.35-.392.392-2.792-.644L13.435 22h-2.87L8.85 19.43l-2.791.644-.392-.392-1.35-1.35-.392-.392.125-.54.518-2.252L2 13.435v-2.87L4.57 8.85 4.05 6.6l-.124-.54.392-.392 1.35-1.35.392-.392.54.125 2.25.518L10.566 2h2.87l1.713 2.57ZM9.75 6.83l-3.06-.707-.567.567.707 3.059L4 11.635v.73l2.83 1.886-.707 3.058.567.567 3.059-.706L11.635 20h.73l1.886-2.83 3.058.706.567-.567-.706-3.058L20 12.364v-.73L17.17 9.75l.706-3.059-.567-.567-3.058.707L12.365 4h-.73z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSettings;
