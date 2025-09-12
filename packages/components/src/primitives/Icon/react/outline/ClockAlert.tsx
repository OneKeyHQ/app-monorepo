import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgClockAlert = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M13 8a1 1 0 1 0-2 0zm-1 4h-1a1 1 0 0 0 .293.707zm1.793 3.207a1 1 0 0 0 1.414-1.414zM1.293 4.543a1 1 0 0 0 1.414 1.414zm4.414-1.586a1 1 0 0 0-1.414-1.414zm15.586 3a1 1 0 1 0 1.414-1.414zm-1.586-4.414a1 1 0 1 0-1.414 1.414zM20 12a8 8 0 0 1-8 8v2c5.523 0 10-4.477 10-10zm-8 8a8 8 0 0 1-8-8H2c0 5.523 4.477 10 10 10zm-8-8a8 8 0 0 1 8-8V2C6.477 2 2 6.477 2 12zm8-8a8 8 0 0 1 8 8h2c0-5.523-4.477-10-10-10zm-1 4v4h2V8zm.293 4.707 2.5 2.5 1.414-1.414-2.5-2.5zm-8.586-6.75 3-3-1.414-1.414-3 3zm20-1.414-3-3-1.414 1.414 3 3z"
    />
  </Svg>
);
export default SvgClockAlert;
