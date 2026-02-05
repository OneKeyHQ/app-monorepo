import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOrange = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19 13a7 7 0 1 0-14 0 7 7 0 0 0 14 0m-4 0a1 1 0 0 1 2 0 5 5 0 0 1-5 5 1 1 0 0 1 0-2 3 3 0 0 0 3-3m1.785-10.475a3.1 3.1 0 0 0-1.52.413 3.46 3.46 0 0 0-1.176 1.114 3.46 3.46 0 0 0 1.553-.46 3.46 3.46 0 0 0 1.143-1.067M21 13a9 9 0 1 1-10.595-8.857 3.73 3.73 0 0 0-1.682-.996 1 1 0 0 1 .555-1.922c1.249.36 2.295 1.099 2.97 2.009a5.45 5.45 0 0 1 2.017-2.028c1.394-.804 2.769-.77 4.148-.543a1 1 0 0 1 .808 1.226 5.46 5.46 0 0 1-2.55 3.416A9 9 0 0 1 21.001 13Z" />
  </Svg>
);
export default SvgOrange;
