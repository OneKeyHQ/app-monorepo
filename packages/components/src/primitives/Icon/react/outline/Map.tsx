import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMap = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m22 18.22-7 2.334-6-2-7 2.334V5.779l7-2.333 6 2 7-2.334v15.109Zm-18-11v10.892l4-1.333V5.887zm6 9.56 4 1.332V7.22l-4-1.333v10.892Zm6-9.56v10.892l4-1.333V5.887z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMap;
