import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgEthereum = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <Path
      d="m8.07 3-.068.228V9.84l.068.067 3.069-1.814L8.069 3Z"
      fill="#8C8CA1"
    />
    <Path
      d="M8.07 3 5 8.093l3.07 1.814V3ZM8.07 10.488l-.038.046v2.356l.038.11 3.07-4.325-3.07 1.813Z"
      fill="#8C8CA1"
    />
    <Path
      d="M8.07 13v-2.512L5 8.675 8.07 13ZM8.07 9.907l3.069-1.814-3.07-1.395v3.21Z"
      fill="#8C8CA1"
    />
    <Path d="m5 8.093 3.07 1.814v-3.21L5 8.094Z" fill="#8C8CA1" />
  </Svg>
);
export default SvgEthereum;
