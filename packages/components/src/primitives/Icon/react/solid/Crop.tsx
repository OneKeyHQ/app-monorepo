import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCrop = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15 9H9v6h6z" />
    <Path
      fillRule="evenodd"
      d="M6 2a1 1 0 0 1 1 1v2h10a2 2 0 0 1 2 2v10h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0v-2H7a2 2 0 0 1-2-2V7H3a1 1 0 0 1 0-2h2V3a1 1 0 0 1 1-1m1 15V7h10v10z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCrop;
