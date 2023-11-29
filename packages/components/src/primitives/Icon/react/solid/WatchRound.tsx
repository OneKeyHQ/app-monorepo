import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgWatchRound = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6.809 3.669 6.532 6.16A7.978 7.978 0 0 0 4 12c0 2.303.973 4.38 2.531 5.839l.277 2.492A3 3 0 0 0 9.79 23h4.42a3 3 0 0 0 2.981-2.669l.277-2.491A7.978 7.978 0 0 0 20 12c0-2.304-.974-4.38-2.531-5.839l-.277-2.492A3 3 0 0 0 14.21 1H9.79a3 3 0 0 0-2.98 2.669ZM9.79 3a1 1 0 0 0-.994.89l-.09.818A7.975 7.975 0 0 1 12 4c1.173 0 2.29.253 3.295.708l-.091-.818A1 1 0 0 0 14.21 3H9.79Zm5.504 16.292A7.97 7.97 0 0 1 12 20a7.972 7.972 0 0 1-3.295-.708l.09.818a1 1 0 0 0 .995.89h4.42a1 1 0 0 0 .993-.89l.091-.818ZM13 9a1 1 0 1 0-2 0v3a1 1 0 0 0 .293.707l1.5 1.5a1 1 0 0 0 1.414-1.414L13 11.586V9Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgWatchRound;
