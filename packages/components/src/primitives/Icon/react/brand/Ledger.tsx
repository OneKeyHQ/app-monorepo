import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLedger = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M2 15.762v4.943h7.523v-1.096H3.096v-3.847zm18.904 0v3.847h-6.427v1.096H22v-4.943zM9.534 8.238v7.523h4.943v-.988H10.63V8.238zM2 3.295v4.943h1.096V4.391h6.427V3.295zm12.477 0v1.096h6.427v3.847H22V3.295z"
    />
  </Svg>
);
export default SvgLedger;
