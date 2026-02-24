import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEmail = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 4v16H2V4zM12 14.292 4 7.746V18h16V7.746zm0-2.585L18.977 6H5.023z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEmail;
