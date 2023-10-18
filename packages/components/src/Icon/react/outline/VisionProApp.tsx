import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgVisionProApp = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M1 9v4m18 4h1a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h1m12 .5v0a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 7 17.5v0A1.5 1.5 0 0 1 8.5 16h9a1.5 1.5 0 0 1 1.5 1.5Z"
    />
  </Svg>
);
export default SvgVisionProApp;
