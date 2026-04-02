import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAddPages = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15 13h2v2h-2v2h-2v-2h-2v-2h2v-2h2z" />
    <Path
      fillRule="evenodd"
      d="M16 6h4v16H8v-4H4V2h12zm-6 14h8V8h-8zm-4-4h2V6h6V4H6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAddPages;
