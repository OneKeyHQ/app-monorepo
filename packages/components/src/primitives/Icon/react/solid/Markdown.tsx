import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMarkdown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 20H2V4h20zM15 9v2.75h-1.82L16 15.173l2.82-3.423H17V9zM6 9v6h2v-2.91l1.25 1.429 1.25-1.43V15h2V9h-1.954L9.25 10.481 7.954 9z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMarkdown;
