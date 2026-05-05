import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgColorSwatch = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m13 2.933 6.512 3.76-.467.807 3.76 6.513-12.179 7.013A5.5 5.5 0 0 1 2 16.5V2h11zM7.5 15a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m6.025 2.061 6.548-3.78L17.891 9.5zM13 13.971l3.78-6.546L13 5.242v8.73Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgColorSwatch;
