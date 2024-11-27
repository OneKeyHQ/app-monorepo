import { filterReactWebElementNonStandardProps } from '../utils/debug/filterReactWebElementNonStandardProps';

function reactCreateElementShim() {
  // development monkey patch
  if (process.env.NODE_ENV !== 'production') {
    const React = require('react') as typeof import('react');
    const originalCreateElement = React.createElement;

    // @ts-ignore
    React.createElement = (type: any, props: any, ...children: any[]) => {
      if (props) {
        const { standardProps, nonStandardProps } =
          filterReactWebElementNonStandardProps(type, props);
        return originalCreateElement(type, standardProps, ...children);
      }
      return originalCreateElement(type, props, ...children);
    };
  }
}

reactCreateElementShim();
