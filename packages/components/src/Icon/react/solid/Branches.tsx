import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBranches = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M7.5 2a3.5 3.5 0 0 0-1 6.855v6.29A3.502 3.502 0 0 0 7.5 22a3.5 3.5 0 0 0 1-6.855V14a1 1 0 0 1 1-1h5a3 3 0 0 0 3-3V8.855A3.502 3.502 0 0 0 16.5 2a3.5 3.5 0 0 0-1 6.855V10a1 1 0 0 1-1 1h-5c-.35 0-.687.06-1 .17V8.856A3.502 3.502 0 0 0 7.5 2Z"
    />
  </Svg>
);
export default SvgBranches;
