import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFinder = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6 3h5.917a47.087 47.087 0 0 0-1.665 9.942A1 1 0 0 0 11.25 14h2a1 1 0 1 0 0-2h-.928c.252-3.066.814-6.03 1.674-9H18a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm3 6a1 1 0 0 0-2 0v1a1 1 0 1 0 2 0V9Zm8 0a1 1 0 1 0-2 0v1a1 1 0 1 0 2 0V9Zm-8.445 5.668a1 1 0 0 0-1.11 1.664C9.02 17.382 10.466 18 12 18c1.534 0 2.98-.619 4.555-1.668a1 1 0 0 0-1.11-1.664C14.02 15.618 12.966 16 12 16c-.966 0-2.02-.381-3.445-1.332Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFinder;
