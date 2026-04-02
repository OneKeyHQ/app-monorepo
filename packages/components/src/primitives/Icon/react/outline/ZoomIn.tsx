import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgZoomIn = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 10h3v2h-3v3h-2v-3H7v-2h3V7h2z" />
    <Path
      fillRule="evenodd"
      d="M11 3a8 8 0 0 1 8 8c0 1.849-.63 3.549-1.683 4.903L21.414 20 20 21.414l-4.097-4.097A7.96 7.96 0 0 1 11 19a8 8 0 1 1 0-16m0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgZoomIn;
