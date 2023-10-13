import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSunUp = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M3 19a1 1 0 1 0 0 2v-2Zm18 2a1 1 0 1 0 0-2v2ZM11 8a1 1 0 1 0 2 0h-2Zm2-4a1 1 0 1 0-2 0h2ZM7 16a1 1 0 1 0 2 0H7Zm8 0a1 1 0 1 0 2 0h-2ZM3 15a1 1 0 1 0 0 2v-2Zm1 2a1 1 0 1 0 0-2v2Zm16-2a1 1 0 1 0 0 2v-2Zm1 2a1 1 0 1 0 0-2v2Zm-3.514-6.908a1 1 0 1 0 1.286 1.532l-1.286-1.532Zm2.052.889a1 1 0 0 0-1.286-1.532l1.286 1.532ZM5.748 9.449a1 1 0 1 0-1.285 1.532l1.285-1.532Zm-.52 2.175a1 1 0 0 0 1.286-1.532L5.23 11.624Zm3.065-7.331a1 1 0 0 0 1.414 1.414L8.293 4.293ZM12 2l.707-.707a1 1 0 0 0-1.414 0L12 2Zm2.293 3.707a1 1 0 1 0 1.414-1.414l-1.414 1.414ZM3 21h18v-2H3v2ZM13 8V4h-2v4h2Zm-4 8a3 3 0 0 1 3-3v-2a5 5 0 0 0-5 5h2Zm3-3a3 3 0 0 1 3 3h2a5 5 0 0 0-5-5v2Zm-9 4h1v-2H3v2Zm17 0h1v-2h-1v2Zm-1.228-5.376.766-.643-1.286-1.532-.766.643 1.286 1.532Zm-14.31-.643.767.643 1.285-1.532-.766-.643-1.285 1.532Zm5.245-5.274 3-3-1.414-1.414-3 3 1.414 1.414Zm1.586-3 3 3 1.414-1.414-3-3-1.414 1.414Z"
    />
  </Svg>
);
export default SvgSunUp;
