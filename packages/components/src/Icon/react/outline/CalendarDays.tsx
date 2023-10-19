import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCalendarDays = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 8h16M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"
    />
    <Path
      fill="currentColor"
      d="M9.25 12a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm0 4a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm4-4a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm0 4a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm4-4a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z"
    />
  </Svg>
);
export default SvgCalendarDays;
