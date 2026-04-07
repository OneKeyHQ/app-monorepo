import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBulkSendManyToOne = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3 6a2.998 2.998 0 0 1 5.825-1H13v6h2.174a2.998 2.998 0 1 1 1.311 3.583A3 3 0 0 1 15.174 13H13v6H8.825a2.998 2.998 0 1 1-5.12-2.933 2.998 2.998 0 0 1 5.12.933H11V7H8.825A2.998 2.998 0 0 1 3 6m14 6a1 1 0 1 0 2 0 1 1 0 0 0-2 0M5 18a1 1 0 1 0 2 0 1 1 0 0 0-2 0M5 6a1 1 0 1 0 2 0 1 1 0 0 0-2 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBulkSendManyToOne;
