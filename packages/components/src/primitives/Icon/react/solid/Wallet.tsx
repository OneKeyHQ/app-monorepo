import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgWallet = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M6.5 3A3.5 3.5 0 0 0 3 6.5V17a4 4 0 0 0 4 4h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2V4.75A1.75 1.75 0 0 0 15.25 3zM15 8V5H6.5a1.5 1.5 0 1 0 0 3zm.5 7.75a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgWallet;
