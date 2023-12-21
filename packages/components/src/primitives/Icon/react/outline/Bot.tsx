import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBot = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 4H7a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-5Zm0 0V2M6 15l-2 2m2-2a6 6 0 0 0 12 0M6 15v-2m12 2 2 2m-2-2v-2M9 8v1m6-1v1"
    />
  </Svg>
);
export default SvgBot;
