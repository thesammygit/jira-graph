/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Production Content-Security-Policy, injected at build time (dev needs the
 * HMR websocket, which this would block). Enforced by the browser, this is
 * the hard guarantee that the deployed app cannot make ANY external request:
 * scripts, styles, workers, and connections are same-origin only; everything
 * else is denied. style-src needs 'unsafe-inline' for React style attributes.
 */
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const injectCsp: Plugin = {
  name: 'inject-csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
};

export default defineConfig({
  plugins: [react(), injectCsp],
  base: './',
  test: { globals: true, environment: 'node' },
});
