import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDeleteSimple = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="m5.876 19.133.997-.066-.997.066Zm12.248 0-.997-.066.998.066ZM3 5a1 1 0 0 0 0 2V5Zm18 2a1 1 0 1 0 0-2v2Zm-6.094-.75a1 1 0 1 0 1.936-.5l-1.936.5ZM4.002 6.066 4.878 19.2l1.995-.133-.875-13.134-1.996.134ZM7.872 22h8.257v-2H7.87v2Zm11.25-2.8.876-13.133-1.996-.134-.875 13.134 1.995.133ZM19 5H5v2h14V5ZM3 7h2V5H3v2Zm16 0h2V5h-2v2Zm-2.871 15a3 3 0 0 0 2.993-2.8l-1.995-.133a1 1 0 0 1-.998.933v2ZM4.878 19.2A3 3 0 0 0 7.87 22v-2a1 1 0 0 1-.998-.933l-1.995.133ZM12 4c1.396 0 2.572.955 2.906 2.25l1.936-.5A5.002 5.002 0 0 0 12 2v2ZM9.094 6.25A3.002 3.002 0 0 1 12 4V2a5.002 5.002 0 0 0-4.842 3.75l1.936.5Z"
    />
  </Svg>
);
export default SvgDeleteSimple;
