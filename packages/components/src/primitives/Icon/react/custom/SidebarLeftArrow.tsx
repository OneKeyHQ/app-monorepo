import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSidebarLeftArrow = (props: SvgProps) => (
  <Svg viewBox="0 0 24 25" fill="none" accessibilityRole="image" {...props}>
    <Path
      d="M9 4.33H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3m0-16h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9m0-16v16"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="m15.5 10.33-2 2 2 2"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
export default SvgSidebarLeftArrow;
