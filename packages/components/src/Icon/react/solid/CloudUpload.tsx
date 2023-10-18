import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCloudUpload = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M5.598 8.165a7 7 0 0 1 13.343 1.923A5.002 5.002 0 0 1 18 20h-5v-5.586l.793.793a1 1 0 0 0 1.414-1.414l-2.5-2.5a1 1 0 0 0-1.414 0l-2.5 2.5a1 1 0 1 0 1.414 1.414l.793-.793V20H7A6 6 0 0 1 5.598 8.165Z"
    />
  </Svg>
);
export default SvgCloudUpload;
