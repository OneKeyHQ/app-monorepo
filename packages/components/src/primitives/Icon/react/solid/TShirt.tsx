import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTShirt = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="#000"
      fillRule="evenodd"
      d="M9.508 3.535c-.351-.498-1-.794-1.547-.526L2.252 5.805a2 2 0 0 0-1.047 2.331l.237.854a2 2 0 0 0 2.543 1.367L5 10.028V18a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-7.972l1.015.33a2 2 0 0 0 2.543-1.368l.237-.854a2 2 0 0 0-1.047-2.331L16.04 3.009c-.548-.268-1.196.028-1.548.526-1.244 1.763-3.74 1.763-4.984 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTShirt;
