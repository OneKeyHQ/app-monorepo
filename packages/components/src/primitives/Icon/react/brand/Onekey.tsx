import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOnekey = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="#44D62C"
      d="M23 12c0 7.594-3.406 11-11 11S1 19.594 1 12 4.406 1 12 1s11 3.406 11 11"
    />
    <Path fill="#000" d="M12.994 5.665h-3.06l-.537 1.623h1.7v3.42h1.897z" />
    <Path
      fill="#000"
      fillRule="evenodd"
      d="M15.49 14.846a3.49 3.49 0 1 1-6.98 0 3.49 3.49 0 0 1 6.98 0m-1.584 0a1.906 1.906 0 1 1-3.811 0 1.906 1.906 0 0 1 3.81 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgOnekey;
