import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCloudSync = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M5.598 8.165a7 7 0 0 1 13.343 1.923A5.002 5.002 0 0 1 18 20H7A6 6 0 0 1 5.598 8.165ZM12 12.107v-.858a1.5 1.5 0 1 0 1.2 2.4 1 1 0 1 1 1.6 1.2 3.5 3.5 0 1 1-2.8-5.6V8.39a.5.5 0 0 1 .84-.368l2.012 1.858a.5.5 0 0 1 0 .735l-2.013 1.858a.5.5 0 0 1-.839-.367Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCloudSync;
