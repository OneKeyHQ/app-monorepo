import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgKnob = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M7.977 7.522c2.322-2.098 6.035-2.026 8.266.21a6.027 6.027 0 0 1 .001 8.505 5.99 5.99 0 0 1-8.488 0 6.027 6.027 0 0 1 0-8.505zm6.85 1.623c-1.522-1.527-4.136-1.526-5.654-.001a4.027 4.027 0 0 0 0 5.681 3.99 3.99 0 0 0 4.858.62l-2.73-2.731 1.414-1.414 2.728 2.728a4.03 4.03 0 0 0-.616-4.883"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM5 19h14V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgKnob;
