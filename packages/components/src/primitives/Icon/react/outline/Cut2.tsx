import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCut2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M5.75 3a4 4 0 0 1 2.81 6.846l2.19.906V9.14a2 2 0 0 1 1.162-1.816l5.345-2.467a2 2 0 0 1 2.119.28l2.515 2.094a1 1 0 0 1-.258 1.693l-7.434 3.075 7.434 3.076a1 1 0 0 1 .258 1.693l-2.515 2.095a2 2 0 0 1-2.12.28l-5.344-2.467a2 2 0 0 1-1.162-1.817v-1.69l-2.247.93a4 4 0 1 1-2.581-1.096l2.52-1.042-2.36-.976A4 4 0 1 1 5.75 3m0 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4m7-.14 5.344 2.466h.002l1.242-1.036-6.588-2.725zm0-5.72v1.295l6.588-2.727-1.242-1.035zM5.75 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCut2;
