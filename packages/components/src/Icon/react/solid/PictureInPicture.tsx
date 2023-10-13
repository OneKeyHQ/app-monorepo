import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPictureInPicture = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M4 7a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v4a1 1 0 1 0 2 0V7a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h4a1 1 0 1 0 0-2H5a1 1 0 0 1-1-1V7Z"
    />
    <Path
      fill="currentColor"
      d="M14 14a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2h-6Z"
    />
  </Svg>
);
export default SvgPictureInPicture;
