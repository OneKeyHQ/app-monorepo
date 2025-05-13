import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgYen = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M9.253 7.341a1 1 0 1 0-1.506 1.317zm7 1.317a1 1 0 0 0-1.506-1.316zM11 17a1 1 0 1 0 2 0zm-1-5a1 1 0 1 0 0 2zm4 2a1 1 0 1 0 0-2zM7.747 8.659l3.5 4 1.506-1.318-3.5-4zm5.006 4 3.5-4-1.506-1.318-3.5 4zM11 12v1h2v-1zm0 1v4h2v-4zm-1 1h2v-2h-2zm2 0h2v-2h-2zm8-2a8 8 0 0 1-8 8v2c5.523 0 10-4.477 10-10zm-8 8a8 8 0 0 1-8-8H2c0 5.523 4.477 10 10 10zm-8-8a8 8 0 0 1 8-8V2C6.477 2 2 6.477 2 12zm8-8a8 8 0 0 1 8 8h2c0-5.523-4.477-10-10-10z"
    />
  </Svg>
);
export default SvgYen;
