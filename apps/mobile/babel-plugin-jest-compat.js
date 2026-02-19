// Babel plugin for jest compatibility when bundling for react-native-harness.
// Active only when RN_HARNESS=true. This is needed because:
// 1. jest.mock() relies on babel-jest hoisting, which Metro does not support
// 2. jest.requireActual/requireMock need to become plain require() calls
//
// Transforms:
// - jest.requireActual('x') -> require('x')
// - jest.requireMock('x') -> require('x')
//
// Note: jest.mock() calls are NOT stripped. Instead, the runtime shim in
// jest-harness-setup.ts handles them by mutating module exports in-place.

module.exports = function ({ types: t }) {
  if (!process.env.RN_HARNESS) {
    return { visitor: {} };
  }

  return {
    name: 'babel-plugin-jest-compat',
    visitor: {
      CallExpression(path) {
        const callee = path.node.callee;

        // jest.requireActual('module') -> require('module')
        // jest.requireMock('module') -> require('module')
        if (
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.object, { name: 'jest' }) &&
          (t.isIdentifier(callee.property, { name: 'requireActual' }) ||
            t.isIdentifier(callee.property, { name: 'requireMock' }))
        ) {
          path.replaceWith(
            t.callExpression(t.identifier('require'), path.node.arguments),
          );
        }
      },
    },
  };
};
