// Client entry — runs at app bootstrap, before route/layout modules and long before the quereus-p2p
// (Optimystic/libp2p) stack is lazy-loaded. Load the browser polyfills FIRST so the timer .ref/.unref
// and Buffer shims are in place before any libp2p module evaluates. See src/polyfills.ts.
import './polyfills';
