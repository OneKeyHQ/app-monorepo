import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAddPages = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M16 6h4v16H8v-4H4V2h12zm-3 7h-2v2h2v2h2v-2h2v-2h-2v-2h-2zM6 4v12h2V6h6V4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAddPages;
