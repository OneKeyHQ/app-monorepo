import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentGraph1 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M7 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h5.101A7 7 0 0 1 20 10.674V5a3 3 0 0 0-3-3z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M17 12a5 5 0 1 0 0 10 5 5 0 0 0 0-10m-3 5c0-1.306.835-2.418 2-2.83V17a1 1 0 0 0 .293.707l2 2A3 3 0 0 1 14 17m4-.414V14.17a3 3 0 0 1 1.708 4.123z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDocumentGraph1;
