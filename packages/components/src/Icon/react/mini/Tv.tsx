import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTv = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 5h12v7H4V5z" />
    <Path
      fillRule="evenodd"
      d="M1 3.5A1.5 1.5 0 0 1 2.5 2h15A1.5 1.5 0 0 1 19 3.5v10a1.5 1.5 0 0 1-1.5 1.5H12v1.5h3.25a.75.75 0 0 1 0 1.5H4.75a.75.75 0 0 1 0-1.5H8V15H2.5A1.5 1.5 0 0 1 1 13.5v-10zm16.5 0h-15v10h15v-10z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTv;
