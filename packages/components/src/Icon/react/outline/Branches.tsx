import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBranches = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm0 0v7m9-7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm0 0v2a2 2 0 0 1-2 2h-5a2 2 0 0 0-2 2v2m0 0a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"
    />
  </Svg>
);
export default SvgBranches;
