import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgVolumeOffMute = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M17 5.586V4.5c0-1.236-1.411-1.942-2.4-1.2L9.933 6.8a1 1 0 0 1-.6.2H8a3 3 0 0 0-3 3v4c0 .978.468 1.846 1.192 2.394l-2.9 2.899a1 1 0 1 0 1.415 1.414l16-16a1 1 0 0 0-1.414-1.414L17 5.586Zm-6.433 12.089L17 11.243V19.5c0 1.236-1.411 1.941-2.4 1.2l-4.033-3.025Z"
    />
  </Svg>
);
export default SvgVolumeOffMute;
