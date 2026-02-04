import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCube = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11.03 2.549a1.98 1.98 0 0 1 1.94 0l6.93 3.897.02.011L12 10.911 4.08 6.457l.02-.01zM3.092 8.17v7.75A1.98 1.98 0 0 0 4.1 17.648l6.91 3.887v-8.908L3.09 8.17Zm9.898 13.362 6.909-3.886a1.98 1.98 0 0 0 1.01-1.725v-7.75l-7.919 4.454z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCube;
