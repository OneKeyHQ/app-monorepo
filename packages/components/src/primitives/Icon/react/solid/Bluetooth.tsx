import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBluetooth = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M9.865 3.852c0-1.554 1.797-2.418 3.01-1.447l4.77 3.815a1.853 1.853 0 0 1 0 2.894L14.035 12l3.608 2.886a1.853 1.853 0 0 1 0 2.894l-4.769 3.816c-1.213.97-3.01.106-3.01-1.448v-4.81l-3.657 2.925a1.083 1.083 0 1 1-1.354-1.692l5.01-4.008v-1.126L4.855 7.43a1.083 1.083 0 0 1 1.354-1.692l3.657 2.926V3.852Zm2.437 6.76-.27-.216V4.504l3.953 3.163-3.683 2.946Zm0 2.775-.27.217v5.892l3.953-3.163-3.683-2.946Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBluetooth;
