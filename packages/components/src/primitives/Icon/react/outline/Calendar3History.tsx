import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCalendar3History = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20 8.5V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h2.5M8 5V3m8 2V3m1 12v2l1.5 1.5m-3.413-6.118a4.998 4.998 0 1 1 3.826 9.236 4.998 4.998 0 0 1-3.826-9.236Z"
    />
  </Svg>
);
export default SvgCalendar3History;
