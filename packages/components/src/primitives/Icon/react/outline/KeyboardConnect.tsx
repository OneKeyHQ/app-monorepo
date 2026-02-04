import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgKeyboardConnect = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 15.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m12 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5M14 16a1 1 0 1 1 0 2h-4a1 1 0 1 1 0-2zm-8-4.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m4 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m4 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m4 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5" />
    <Path
      fillRule="evenodd"
      d="M18 2a1 1 0 0 1 1 1v1a2 2 0 0 1-2 2H7v2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h2V6a2 2 0 0 1 2-2h10V3a1 1 0 0 1 1-1M3 20h18V10H3z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgKeyboardConnect;
