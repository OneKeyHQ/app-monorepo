import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCalendar3Add = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 5V3m8 2V3m-4 7v5m2.5-2.5h-5M6 20h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2Z"
    />
  </Svg>
);
export default SvgCalendar3Add;
