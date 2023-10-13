import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFiles = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 18v1a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1m7-3h-5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8m-5-5 5 5m-5-5v3a2 2 0 0 0 2 2h3"
    />
  </Svg>
);
export default SvgFiles;
