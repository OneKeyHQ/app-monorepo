import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgVolumeHalfOn = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M10.6 3.3c.989-.742 2.4-.036 2.4 1.2v15c0 1.236-1.411 1.942-2.4 1.2l-4.667-3.5a1 1 0 0 0-.6-.2H4a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3h1.333a1 1 0 0 0 .6-.2L10.6 3.3Zm4.582 4.104a1 1 0 0 1 1.414 0A6.483 6.483 0 0 1 18.5 12a6.483 6.483 0 0 1-1.904 4.597 1 1 0 0 1-1.414-1.415A4.483 4.483 0 0 0 16.5 12a4.483 4.483 0 0 0-1.318-3.182 1 1 0 0 1 0-1.414Z"
    />
  </Svg>
);
export default SvgVolumeHalfOn;
