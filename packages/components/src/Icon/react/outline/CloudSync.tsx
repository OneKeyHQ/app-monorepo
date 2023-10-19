import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCloudSync = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 19a5 5 0 0 1-.674-9.955A6 6 0 0 1 18 11a4 4 0 0 1 0 8H7Z"
    />
    <Path
      fill="currentColor"
      d="M12 11.249v.858a.5.5 0 0 0 .84.367l2.012-1.858a.5.5 0 0 0 0-.734l-2.013-1.858A.5.5 0 0 0 12 8.39v.858a3.5 3.5 0 1 0 2.8 5.6 1 1 0 0 0-1.6-1.2 1.5 1.5 0 1 1-1.2-2.4Z"
    />
  </Svg>
);
export default SvgCloudSync;
