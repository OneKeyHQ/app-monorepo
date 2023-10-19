import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCloudArrowDown = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M1 12a8 8 0 0 1 14.979-3.913A6 6 0 0 1 19.4 19.5a1 1 0 0 1-.801-1.833 4.001 4.001 0 0 0-2.85-7.47 1 1 0 0 1-1.23-.556 6.002 6.002 0 1 0-8.948 7.283 1 1 0 0 1-1.144 1.64A7.992 7.992 0 0 1 1 12Zm11 1a1 1 0 0 1 1 1v3.586l.793-.793a1 1 0 0 1 1.414 1.414l-2.5 2.5a1 1 0 0 1-1.414 0l-2.5-2.5a1 1 0 1 1 1.414-1.414l.793.793V14a1 1 0 0 1 1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCloudArrowDown;
