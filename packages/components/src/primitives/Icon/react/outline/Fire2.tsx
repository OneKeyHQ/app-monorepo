import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFire2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 21c4.142 0 7.5-3.5 7.5-8 0-5.002-4.42-8.555-6.236-9.804-.426-.292-.99-.167-1.287.257L9.662 6.76a.968.968 0 0 1-1.478.13c-.378-.378-.994-.38-1.333.033C5.284 8.833 4.5 11.213 4.5 13c0 4.5 3.358 8 7.5 8Zm0 0c1.657 0 3-1.533 3-3.424 0-2.083-1.663-3.6-2.513-4.24a.803.803 0 0 0-.974 0c-.85.64-2.513 2.157-2.513 4.24C9 19.467 10.343 21 12 21Z"
    />
  </Svg>
);
export default SvgFire2;
