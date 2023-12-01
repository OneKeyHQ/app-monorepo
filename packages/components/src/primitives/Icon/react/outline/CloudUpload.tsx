import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCloudUpload = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 19v-7m0 0 2.5 2.5M12 12l-2.5 2.5M8 19H7a5 5 0 0 1-.674-9.955A6 6 0 0 1 18 11a4 4 0 0 1 0 8h-2"
    />
  </Svg>
);
export default SvgCloudUpload;
