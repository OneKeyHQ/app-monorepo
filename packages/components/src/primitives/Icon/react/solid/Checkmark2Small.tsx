import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCheckmark2Small = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M17.659 7.247a1 1 0 0 1 .094 1.412l-7 8a1 1 0 0 1-1.46.048l-3-3a1 1 0 1 1 1.414-1.414l2.244 2.244 6.296-7.195a1 1 0 0 1 1.412-.095"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCheckmark2Small;
