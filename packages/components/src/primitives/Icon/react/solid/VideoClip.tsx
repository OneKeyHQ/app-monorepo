import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgVideoClip = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm3-1a1 1 0 0 0-1 1v1h2V5H6Zm11 0v2h2V6a1 1 0 0 0-1-1h-1Zm2 4h-2v2h2V9Zm0 4h-2v2.444h2V13Zm0 4.444h-2V19h1a1 1 0 0 0 1-1v-.556ZM15 13v-2H9v2h6Zm-8 6v-2H5v1a1 1 0 0 0 1 1h1Zm-2-4h2v-2H5v2Zm0-4h2V9H5v2Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgVideoClip;
