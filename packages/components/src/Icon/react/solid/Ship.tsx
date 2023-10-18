import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgShip = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M9 3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3h2a2 2 0 0 1 2 2v2.658L12.97 9.15a4 4 0 0 0-1.94 0L5 10.658V8a2 2 0 0 1 2-2h2V3Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="m19.22 18.58 1.997.444a1 1 0 1 1-.434 1.952l-4.066-.903a.998.998 0 0 0-.434 0l-3.632.807a2.999 2.999 0 0 1-1.302 0l-3.632-.807a.998.998 0 0 0-.434 0l-4.066.903a1 1 0 0 1-.434-1.952l1.997-.444c-1.163-1.944-2.8-5.106.697-5.98l5.796-1.449a3 3 0 0 1 1.455 0l5.795 1.449c3.497.874 1.86 4.036.698 5.98Z"
    />
  </Svg>
);
export default SvgShip;
