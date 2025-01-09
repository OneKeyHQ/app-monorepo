import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChecklistBoxSearch = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m7.543 9.498 1.125.75 1.872-2.496M14.058 9h2m-8.515 6.499 1.125.75 1.872-2.496M10 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4m-.879 9.121a3 3 0 1 1-4.242-4.242 3 3 0 0 1 4.242 4.242Zm0 0L21 21"
    />
  </Svg>
);
export default SvgChecklistBoxSearch;
