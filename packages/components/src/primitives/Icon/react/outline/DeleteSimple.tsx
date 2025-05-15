import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDeleteSimple = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="m5.876 19.133.997-.066zm12.248 0-.997-.066.998.066ZM3 5a1 1 0 0 0 0 2zm18 2a1 1 0 1 0 0-2zm-6.094-.75a1 1 0 1 0 1.936-.5zM4.002 6.066 4.878 19.2l1.995-.133-.875-13.134-1.996.134ZM7.872 22h8.257v-2H7.87v2Zm11.25-2.8.876-13.133-1.996-.134-.875 13.134zM19 5H5v2h14zM3 7h2V5H3zm16 0h2V5h-2zm-2.871 15a3 3 0 0 0 2.993-2.8l-1.995-.133a1 1 0 0 1-.998.933zM4.878 19.2A3 3 0 0 0 7.87 22v-2a1 1 0 0 1-.998-.933l-1.995.133ZM12 4c1.396 0 2.572.955 2.906 2.25l1.936-.5A5 5 0 0 0 12 2zM9.094 6.25A3 3 0 0 1 12 4V2a5 5 0 0 0-4.842 3.75z"
    />
  </Svg>
);
export default SvgDeleteSimple;
