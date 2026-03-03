import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAvocado = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M17.089 2.002c1.361-.03 2.71.278 3.672 1.24.96.963 1.267 2.314 1.237 3.677-.03 1.371-.402 2.894-.961 4.393-1.117 2.994-3.069 6.123-5.022 8.14-3.08 3.178-8.454 3.513-11.693.268-3.295-3.201-2.965-8.582.241-11.708 2.018-1.968 5.146-3.927 8.138-5.047 1.498-.56 3.018-.932 4.388-.963m-7.34 8.748a3.5 3.5 0 1 0 .001 7 3.5 3.5 0 0 0 0-7Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAvocado;
