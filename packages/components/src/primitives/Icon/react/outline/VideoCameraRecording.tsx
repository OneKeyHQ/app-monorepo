import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgVideoCameraRecording = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 5h9a2 2 0 0 1 2 2v2l3.553-1.776A1 1 0 0 1 21 8.118v7.764a1 1 0 0 1-1.447.894L16 15v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
    />
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"
    />
  </Svg>
);
export default SvgVideoCameraRecording;
