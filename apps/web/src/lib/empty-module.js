// Empty stub aliased in for node/test-only imports that are dead on the browser path
// (see vite.config.ts). @optimystic/db-p2p ships a test conformance module that imports
// `chai`; these named exports exist only to satisfy the bundler — they are never called.
const noop = () => {};
export const expect = noop;
export const assert = noop;
export const should = noop;
export const use = noop;
export const config = {};
export default {};
