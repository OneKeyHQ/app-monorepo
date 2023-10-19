import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPanoramaView = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M22 16.964V7.022c0-1.364-1.337-2.326-2.66-1.993-4.987 1.254-9.693 1.254-14.68 0C3.338 4.696 2 5.658 2 7.022v9.942c0 1.368 1.345 2.331 2.671 1.994 4.964-1.26 9.694-1.26 14.658 0 1.326.337 2.671-.626 2.671-1.994Z"
    />
  </Svg>
);
export default SvgPanoramaView;
