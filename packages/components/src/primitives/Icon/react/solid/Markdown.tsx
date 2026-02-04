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
      d="M4 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm3.664 5.253A1 1 0 0 0 6 10v4a1 1 0 1 0 2 0v-1.773l.586.52a1 1 0 0 0 1.328 0l.586-.52V14a1 1 0 1 0 2 0v-4a1 1 0 0 0-1.664-.747L9.25 10.662zM17 10a1 1 0 1 0-2 0v1.884a1 1 0 0 0-1.14 1.634l1.5 1.25a1 1 0 0 0 1.28 0l1.5-1.25A1 1 0 0 0 17 11.884z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMarkdown;
