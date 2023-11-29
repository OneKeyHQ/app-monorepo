import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgServer = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v5m18 0H3m18 0v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5"
    />
    <Path
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={0.75}
      d="M6.5 9.375a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75Zm0 7a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75Z"
    />
  </Svg>
);
export default SvgServer;
