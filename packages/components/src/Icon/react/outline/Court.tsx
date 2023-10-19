import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCourt = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 20h16M6 17V9m4 8V9m4 8V9m4 8V9M5 9h14a1 1 0 0 0 1-1V6.235a1 1 0 0 0-.702-.954l-7-2.188a1 1 0 0 0-.596 0l-7 2.188A1 1 0 0 0 4 6.235V8a1 1 0 0 0 1 1Z"
    />
  </Svg>
);
export default SvgCourt;
