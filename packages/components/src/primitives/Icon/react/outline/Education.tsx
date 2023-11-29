import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgEducation = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m22 9-10 5L2 9l10-5 10 5Zm0 0v6m-4-4v5.014a2 2 0 0 1-1.106 1.789l-4 2a2 2 0 0 1-1.788 0l-4-2A2 2 0 0 1 6 16.013V11"
    />
  </Svg>
);
export default SvgEducation;
