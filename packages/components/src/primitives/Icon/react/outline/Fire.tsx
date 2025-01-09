import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFire = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19.5 13.812c0 9.579-15 9.59-15 0C4.5 6.614 12 2.5 12 2.5s7.5 4.114 7.5 11.312Z"
    />
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15.5 17.406c0 4.79-7 4.795-7 0 0-3.6 3.5-5.656 3.5-5.656s3.5 2.057 3.5 5.656Z"
    />
  </Svg>
);
export default SvgFire;
