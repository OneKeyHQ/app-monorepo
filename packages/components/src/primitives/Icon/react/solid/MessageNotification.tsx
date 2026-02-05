import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessageNotification = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M19 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8m-2 4a2 2 0 1 1 4 0 2 2 0 0 1-4 0"
      clipRule="evenodd"
    />
    <Path d="M13 6c0-1.093.292-2.117.803-3H4.002a2 2 0 0 0-2 2v12.036a2 2 0 0 0 2 2h4.65l2.703 2.266a1 1 0 0 0 1.28.004l2.74-2.27h4.627a2 2 0 0 0 2-2v-5.84A6 6 0 0 1 13 6" />
  </Svg>
);
export default SvgMessageNotification;
