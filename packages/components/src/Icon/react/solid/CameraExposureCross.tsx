import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCameraExposureCross = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M5 6a1 1 0 0 1 1-1h2a1 1 0 0 0 0-2H6a3 3 0 0 0-3 3v2a1 1 0 0 0 2 0V6Zm11-3a1 1 0 1 0 0 2h2a1 1 0 0 1 1 1v2a1 1 0 1 0 2 0V6a3 3 0 0 0-3-3h-2ZM5 16a1 1 0 1 0-2 0v2a3 3 0 0 0 3 3h2a1 1 0 1 0 0-2H6a1 1 0 0 1-1-1v-2Zm16 0a1 1 0 1 0-2 0v2a1 1 0 0 1-1 1h-2a1 1 0 1 0 0 2h2a3 3 0 0 0 3-3v-2ZM10.586 9.172a1 1 0 0 0-1.414 1.414L10.586 12l-1.414 1.414a1 1 0 1 0 1.414 1.414L12 13.414l1.414 1.414a1 1 0 0 0 1.414-1.414L13.414 12l1.414-1.414a1 1 0 0 0-1.414-1.414L12 10.586l-1.414-1.414Z"
    />
  </Svg>
);
export default SvgCameraExposureCross;
