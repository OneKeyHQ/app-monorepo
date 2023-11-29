import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSunUp = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12.707 1.293a1 1 0 0 0-1.414 0l-3 3a1 1 0 0 0 1.414 1.414L11 4.414V8a1 1 0 1 0 2 0V4.414l1.293 1.293a1 1 0 1 0 1.414-1.414l-3-3ZM2 20a1 1 0 0 1 1-1h18a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Zm14-3a1 1 0 0 0 1-1 5 5 0 0 0-10 0 1 1 0 0 0 1 1h8ZM2 16a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Zm17 0a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2h-1a1 1 0 0 1-1-1Zm-1.515-5.908a1 1 0 1 0 1.285 1.532l.766-.643a1 1 0 1 0-1.285-1.532l-.766.643Zm-13.147-.52a1 1 0 0 1 1.409-.123l.766.643a1 1 0 1 1-1.286 1.532l-.766-.643a1 1 0 0 1-.123-1.409Z"
    />
  </Svg>
);
export default SvgSunUp;
