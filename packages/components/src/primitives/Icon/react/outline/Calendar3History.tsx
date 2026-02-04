import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendar3History = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 13.5a1 1 0 0 1 1 1v1.586l1.207 1.207a1 1 0 0 1-1.414 1.414l-1.5-1.5A1 1 0 0 1 15 16.5v-2a1 1 0 0 1 1-1" />
    <Path
      fillRule="evenodd"
      d="M16 10.5a6 6 0 1 1 0 12 6 6 0 0 1 0-12m0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8"
      clipRule="evenodd"
    />
    <Path d="M15 1.5a1 1 0 0 1 1 1v1h2a2 2 0 0 1 2 2V8a1 1 0 1 1-2 0V5.5H4v13h3.5a1 1 0 1 1 0 2H4a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h2v-1a1 1 0 0 1 2 0v1h6v-1a1 1 0 0 1 1-1" />
  </Svg>
);
export default SvgCalendar3History;
