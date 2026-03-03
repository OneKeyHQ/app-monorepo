import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMarkdown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17 11.75h1.82L16 15.173l-2.82-3.423H15V9h2zm-7.75-1.27L10.546 9H12.5v6h-2v-2.91l-1.25 1.429L8 12.089V15H6V9h1.954z" />
    <Path
      fillRule="evenodd"
      d="M22 20H2V4h20zM4 18h16V6H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMarkdown;
