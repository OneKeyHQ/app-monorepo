import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgVolumeFullOn = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19.071 4.93A9.969 9.969 0 0 1 22 12a9.968 9.968 0 0 1-2.929 7.072m-3.182-10.96A5.483 5.483 0 0 1 17.5 12a5.483 5.483 0 0 1-1.61 3.89M4 8h1.333a2 2 0 0 0 1.2-.4L11.2 4.1a.5.5 0 0 1 .8.4v15a.5.5 0 0 1-.8.4l-4.667-3.5a2 2 0 0 0-1.2-.4H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Z"
    />
  </Svg>
);
export default SvgVolumeFullOn;
