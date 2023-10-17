import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDossier = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M2 7a3 3 0 0 1 3-3h3v6h14v7a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7Z"
    />
    <Path fill="currentColor" d="M10 4h5v4h-5V4Zm7 0h2a3 3 0 0 1 3 3v1h-5V4Z" />
  </Svg>
);
export default SvgDossier;
