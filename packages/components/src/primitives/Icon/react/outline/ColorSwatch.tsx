import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgColorSwatch = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7.5 15a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3" />
    <Path
      fillRule="evenodd"
      d="m13 2.933 6.513 3.76-.468.808 3.762 6.514-12.141 6.98A5.5 5.5 0 0 1 2 16.5V2h11zM4 16.5a3.5 3.5 0 1 0 7 0V4H4zm9.541.534 6.531-3.755L17.891 9.5zM13 13.971l3.78-6.547L13 5.242z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgColorSwatch;
