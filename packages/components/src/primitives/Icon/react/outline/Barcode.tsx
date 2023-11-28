import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBarcode = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 5H5a2 2 0 0 0-2 2v2m14-4h2a2 2 0 0 1 2 2v2m0 6v2a2 2 0 0 1-2 2h-2M7 19H5a2 2 0 0 1-2-2v-2m5-5v4m8-4v4m-4-4v2"
    />
  </Svg>
);
export default SvgBarcode;
