import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDownload = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20 15v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3m8.5-.5V4m0 10.5L9 11m3.5 3.5L16 11"
    />
  </Svg>
);
export default SvgDownload;
