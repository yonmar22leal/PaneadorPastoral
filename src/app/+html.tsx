import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Root HTML for web and iOS PWA installation (Add to Home Screen).
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1.00001, viewport-fit=cover"
        />

        {/* iOS Safari & PWA Metatags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Planeador" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#1E3A8A" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />

        <title>Planeador Pastoral - IEC</title>

        {/* Ensure ScrollView works cleanly on web */}
        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: pwaStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const pwaStyles = `
html, body, #root {
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
  background-color: #0F172A;
  overscroll-behavior-y: none;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
}
`;
