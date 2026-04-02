import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCoinsAdd = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M15 7a7 7 0 1 1 0 14 7 7 0 0 1 0-14m-1 6h-2v2h2v2h2v-2h2v-2h-2v-2h-2z"
      clipRule="evenodd"
    />
    <Path d="M9 3c1.938 0 3.692.787 4.959 2.06a9 9 0 0 0-7.613 11.42A7.002 7.002 0 0 1 9 3" />
  </Svg>
);
export default SvgCoinsAdd;
