import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBookOpen = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M11 8a4 4 0 0 0-4-4H3.5A2.5 2.5 0 0 0 1 6.5v11A2.5 2.5 0 0 0 3.5 20h5.223c.52 0 1 .125 1.4.373.36.221.66.524.877.883V8Zm2 13.256c.218-.358.518-.662.877-.883.4-.248.88-.373 1.4-.373H20.5a2.5 2.5 0 0 0 2.5-2.5v-11A2.5 2.5 0 0 0 20.5 4H17a4 4 0 0 0-4 4v13.256Z"
    />
  </Svg>
);
export default SvgBookOpen;
