import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSunDown = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12 1a1 1 0 0 1 1 1v3.586l1.293-1.293a1 1 0 1 1 1.414 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 1.414-1.414L11 5.586V2a1 1 0 0 1 1-1Zm5.361 10.5a1 1 0 0 1 .124-1.408l.766-.643a1 1 0 0 1 1.285 1.532l-.766.643a1 1 0 0 1-1.409-.123ZM8 17a1 1 0 0 1-1-1 5 5 0 0 1 10 0 1 1 0 0 1-1 1H8Zm-6 3a1 1 0 0 1 1-1h18a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Zm1-5a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2H3Zm17 0a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2h-1ZM5.747 9.449A1 1 0 1 0 4.46 10.98l.766.643a1 1 0 0 0 1.286-1.532l-.766-.643Z"
    />
  </Svg>
);
export default SvgSunDown;
