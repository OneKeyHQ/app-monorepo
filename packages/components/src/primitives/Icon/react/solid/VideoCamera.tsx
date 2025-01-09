import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgVideoCamera = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v1.382l3.106-1.553A2 2 0 0 1 22 8.618v6.764a2 2 0 0 1-2.894 1.789L16 15.618V17a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7Zm14 6.382 4 2V8.618l-4 2v2.764Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgVideoCamera;
