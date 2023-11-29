import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgUfo = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7a4 4 0 1 1 8 0M4 20l3.976-6.295m0 0 1.57-2.486c.29-.46.754-.791 1.293-.857a9.426 9.426 0 0 1 2.322 0c.54.066 1.003.398 1.293.857l1.57 2.486m-8.048 0C4.456 13.163 2 11.932 2 10.5 2 8.567 6.477 7 12 7s10 1.567 10 3.5c0 1.432-2.457 2.663-5.976 3.205m0 0L20 20"
    />
  </Svg>
);
export default SvgUfo;
