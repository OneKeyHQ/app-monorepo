import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAr = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M23 5v15h-7.376L12 16.83 8.376 20H1V5zM7.5 9.25a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5m9 0a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAr;
