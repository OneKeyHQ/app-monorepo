import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBulletList = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M6 14a3 3 0 1 1 0 6 3 3 0 0 1 0-6m0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2"
      clipRule="evenodd"
    />
    <Path d="M21 18h-9v-2h9z" />
    <Path
      fillRule="evenodd"
      d="M6 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6m0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2"
      clipRule="evenodd"
    />
    <Path d="M21 8h-9V6h9z" />
  </Svg>
);
export default SvgBulletList;
