import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCodeInsert = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17 6v12h3V6zM2 18V6a2 2 0 0 1 2-2h8a1 1 0 1 1 0 2H4v12h8a1 1 0 1 1 0 2H4a2 2 0 0 1-2-2m5.293-9.207a1 1 0 0 1 1.414 0l2.5 2.5a1 1 0 0 1 0 1.414l-2.5 2.5a1 1 0 1 1-1.414-1.414L9.086 12l-1.793-1.793a1 1 0 0 1 0-1.414M22 18a2 2 0 0 1-2 2h-3v1.5a1 1 0 1 1-2 0v-19a1 1 0 1 1 2 0V4h3a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgCodeInsert;
