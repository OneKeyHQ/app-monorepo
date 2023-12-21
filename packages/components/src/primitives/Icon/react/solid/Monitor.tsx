import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMonitor = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M2 6a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V6Zm4.326 14.946A17.408 17.408 0 0 1 12 20c1.985 0 3.892.332 5.675.946a1 1 0 1 0 .65-1.892A19.406 19.406 0 0 0 12 18c-2.209 0-4.336.37-6.325 1.054a1 1 0 1 0 .65 1.892Z"
    />
  </Svg>
);
export default SvgMonitor;
