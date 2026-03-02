import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPeopleCopy = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M14 9.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6m0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M18 6h4v16H6v-4H2V2h16zM8 20h.709a5.502 5.502 0 0 1 10.585 0H20V8H8zm6.002-2a3.5 3.5 0 0 0-3.16 2h6.32a3.5 3.5 0 0 0-3.16-2M4 16h2V6h10V4H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPeopleCopy;
