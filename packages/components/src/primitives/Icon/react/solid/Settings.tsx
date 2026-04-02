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
      d="m15.145 4.581 2.803-.647 2.118 2.119-.647 2.802L22 10.575v2.85l-2.581 1.72.647 2.803-2.118 2.118-2.803-.647L13.425 22h-2.85l-1.72-2.581-2.802.647-2.12-2.118.648-2.803L2 13.425v-2.85l2.581-1.72-.647-2.802 2.119-2.12 2.802.648L10.575 2h2.85zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSettings;
