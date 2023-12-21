import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMultipleDevices = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path fill="currentColor" d="M17 17a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2h-1Z" />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v2.17c1.165.413 2 1.524 2 2.83v8a3 3 0 0 1-3 3h-5a2.993 2.993 0 0 1-2.236-1H4a3 3 0 0 1-3-3v-2a1 1 0 0 1 1-1h1V6Zm11 13a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-5a1 1 0 0 0-1 1v8Zm-2-2v2H4a1 1 0 0 1-1-1v-1h9Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMultipleDevices;
