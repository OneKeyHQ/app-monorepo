import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTouchId = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6.403 19.048c.184-.443.353-.893.507-1.351m7.431 2.996a28.79 28.79 0 0 0 1.185-4.441m3.92.806C19.81 15.094 20 13.07 20 11A8 8 0 0 0 8.5 3.805m-4.979 11.22c.314-1.29.48-2.639.48-4.025 0-1.74.555-3.35 1.499-4.664M12.001 11a24.975 24.975 0 0 1-1.985 9.78M7.71 14.5c.191-1.138.29-2.307.29-3.5a4 4 0 0 1 8 0c0 .617-.019 1.229-.056 1.836"
    />
  </Svg>
);
export default SvgTouchId;
