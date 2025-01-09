import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCompass = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M18.995 2.533c1.508-.431 2.903.964 2.472 2.473l-3.2 11.2a3 3 0 0 1-2.06 2.06L5.005 21.468c-1.51.431-2.904-.964-2.473-2.472l3.2-11.201a3 3 0 0 1 2.06-2.06l11.202-3.201ZM9.5 12a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCompass;
