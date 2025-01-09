import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChecklist = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 16h7m-7-8h7M4 9l1.5 1 3-4M4 17l1.5 1 3-4"
    />
  </Svg>
);
export default SvgChecklist;
