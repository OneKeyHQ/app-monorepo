import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendar3History = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m18 16.586 1.914 1.914-1.414 1.414-2.5-2.5V14h2z" />
    <Path
      fillRule="evenodd"
      d="M17 11a6 6 0 1 1 0 12 6 6 0 0 1 0-12m0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8"
      clipRule="evenodd"
    />
    <Path d="M9 4h6V2h2v2h4v6.073A8 8 0 0 0 10.072 21H3V4h4V2h2z" />
  </Svg>
);
export default SvgCalendar3History;
