import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMarkdown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 6v12h16V6zm6.5 8v-1.774l-.586.521a1 1 0 0 1-1.328 0L8 12.226V14a1 1 0 1 1-2 0v-4l.01-.146a1 1 0 0 1 1.654-.601l1.586 1.41 1.586-1.41A1 1 0 0 1 12.5 10v4a1 1 0 1 1-2 0m4.5-4a1 1 0 1 1 2 0v1.884a1 1 0 0 1 1.14 1.635l-1.5 1.25a1 1 0 0 1-1.28 0l-1.5-1.25A1.001 1.001 0 0 1 15 11.884zm7 8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgMarkdown;
