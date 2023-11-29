import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPiggyMoney = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M9 21a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2.11a7.03 7.03 0 0 0 .883-1.105 3 3 0 0 0 3.714-4.286 1 1 0 1 0-1.731 1.002 1 1 0 0 1-1.146 1.46A7 7 0 0 0 14 5h-3.992a4.727 4.727 0 0 0-.508-.554c-.59-.549-1.51-1.13-2.839-1.353C5.391 2.88 4.5 3.954 4.5 5v2.084c-.519.56-.89 1.203-1.176 1.851H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h.448A5.77 5.77 0 0 0 5 17.551v1.45a2 2 0 0 0 2 2h2Zm-.75-9a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPiggyMoney;
