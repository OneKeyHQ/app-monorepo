import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCheckmark1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M19.32 4.245a1.5 1.5 0 0 1 .436 2.076l-8.5 13a1.5 1.5 0 0 1-2.395.155l-4.5-5.25a1.5 1.5 0 0 1 2.278-1.952l3.2 3.733 7.406-11.328a1.5 1.5 0 0 1 2.076-.434Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCheckmark1;
