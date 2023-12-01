import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMedalWin = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M4 9a8 8 0 1 1 13 6.245v5.79a1.75 1.75 0 0 1-2.533 1.566L12 21.367 9.533 22.6A1.75 1.75 0 0 1 7 21.035v-5.79A7.985 7.985 0 0 1 4 9Zm5 7.419v4.212l2.217-1.109a1.75 1.75 0 0 1 1.566 0L15 20.631v-4.212A7.978 7.978 0 0 1 12 17a7.978 7.978 0 0 1-3-.581Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMedalWin;
