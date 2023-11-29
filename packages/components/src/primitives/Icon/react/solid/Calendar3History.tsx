import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCalendar3History = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M9 3a1 1 0 0 0-2 0v1H6a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h4.072A8 8 0 0 1 21 10.073V7a3 3 0 0 0-3-3h-1V3a1 1 0 1 0-2 0v1H9V3Z"
    />
    <Path
      fill="currentColor"
      d="M17 14a1 1 0 0 1 1 1v1.586l1.207 1.207a1 1 0 1 1-1.414 1.414l-1.5-1.5A1 1 0 0 1 16 17v-2a1 1 0 0 1 1-1Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M11 17a6 6 0 1 1 12 0 6 6 0 0 1-12 0Zm6-4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalendar3History;
