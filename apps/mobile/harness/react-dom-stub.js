// Empty react-dom stub for the harness environment.
// react-dom requires a DOM (document, window) which doesn't exist on device.
// When bundling for harness, Metro redirects react-dom imports here to prevent
// module-level crashes from react-dom's event system initialization.
//
// Test files that use @testing-library/react have their imports redirected
// by babel-plugin-jest-compat to globalThis.__harness_testing_lib__ instead,
// so this stub is just a safety net for transitive imports.
module.exports = {};
