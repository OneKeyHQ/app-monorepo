import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCalendar3Search = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 5V3m8 2V3m-2.25 11L15 15.25M6 20h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2Zm8.5-8A2.75 2.75 0 1 1 9 12a2.75 2.75 0 0 1 5.5 0Z"
    />
  </Svg>
);
export default SvgCalendar3Search;
