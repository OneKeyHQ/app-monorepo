import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgVolumeOff = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="m21.5 10-2.121 2.121m0 0-2.122 2.122m2.122-2.122L17.257 10m2.122 2.121 2.121 2.122M4 8h1.333a2 2 0 0 0 1.2-.4L11.2 4.1a.5.5 0 0 1 .8.4v15a.5.5 0 0 1-.8.4l-4.667-3.5a2 2 0 0 0-1.2-.4H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Z"
    />
  </Svg>
);
export default SvgVolumeOff;
