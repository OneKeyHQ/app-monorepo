import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBrowser = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 11h18M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2Z"
    />
    <Path
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={0.5}
      d="M6 8.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm3 0a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm3 0a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
    />
  </Svg>
);
export default SvgBrowser;
