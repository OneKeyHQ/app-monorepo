import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChecklistBoxNotification = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m7.543 9.498 1.125.75 1.872-2.496M14.058 9h2m-8.515 6.499 1.125.75 1.872-2.496M11 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4m1 10v-3a3 3 0 1 0-6 0v3h6Z"
    />
    <Path fill="currentColor" d="M18 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Z" />
  </Svg>
);
export default SvgChecklistBoxNotification;
