import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgToolbox = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 11V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v7m-5.996-4h2m-10 4V6.202a2 2 0 0 1 .438-1.25l1.25-1.562a1.04 1.04 0 0 1 1.624 0l1.25 1.562a2 2 0 0 1 .438 1.25V11M3 11h18v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7Z"
    />
  </Svg>
);
export default SvgToolbox;
