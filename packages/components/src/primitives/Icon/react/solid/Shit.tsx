import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShit = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M13 2a5 5 0 0 1 4.455 7.272A4 4 0 0 1 19.8 14.25 3.501 3.501 0 0 1 18.5 21h-13a3.5 3.5 0 0 1-1.3-6.751 4 4 0 0 1 2.053-4.848A4 4 0 0 1 10 4h2V2zm0 14h3v-2h-3zm-3-7v2h3V9z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShit;
