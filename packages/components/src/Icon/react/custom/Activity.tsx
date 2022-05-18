import * as React from 'react';

import { Svg, Path, SvgProps } from '../../../Svg';

function SvgActivity(props: SvgProps) {
  return (
    <Svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <Path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M7.67 2H16.34C19.73 2 22 4.38 22 7.92V16.09C22 19.62 19.73 22 16.34 22H7.67C4.28 22 2 19.62 2 16.09V7.92C2 4.38 4.28 2 7.67 2ZM14.3762 13.681L17.2662 9.95199L17.2262 9.97199C17.3862 9.75199 17.4162 9.47199 17.3062 9.22199C17.1972 8.97199 16.9562 8.80199 16.6972 8.78199C16.4262 8.75199 16.1572 8.87199 15.9962 9.09199L13.5772 12.222L10.8062 10.042C10.6362 9.91199 10.4362 9.86099 10.2362 9.88199C10.0372 9.91199 9.85724 10.021 9.73624 10.181L6.77724 14.032L6.71624 14.122C6.54624 14.441 6.62624 14.851 6.92624 15.072C7.06624 15.162 7.21624 15.222 7.38624 15.222C7.61724 15.232 7.83624 15.111 7.97624 14.922L10.4862 11.691L13.3362 13.832L13.4262 13.891C13.7462 14.061 14.1462 13.982 14.3762 13.681Z"
      />
    </Svg>
  );
}

export default SvgActivity;
