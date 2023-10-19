import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCloudDownload = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 12v6.5m0 0 2.5-2.5M12 18.5 9.5 16M7 19a5 5 0 0 1-.674-9.955A6 6 0 0 1 18 11a4 4 0 0 1 0 8h-1"
    />
  </Svg>
);
export default SvgCloudDownload;
