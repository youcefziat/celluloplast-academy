// CSP sources baked in at build time.
//
// Celluloplast Academy is self-hosted and internal: the only external assets it loads
// unconditionally are the Google Fonts used by the certificate renderer. Everything else
// (a CDN, a video host, a custom font provider) is added at runtime from env vars in
// `hooks.server.ts`, so a pre-built Docker image stays configurable without a rebuild.

const certificateFontSources = {
  styleSrc: ['https://fonts.googleapis.com'],
  fontSrc: ['https://fonts.gstatic.com']
};

export function getCspDomains() {
  return {
    scriptSrc: [],
    styleSrc: certificateFontSources.styleSrc,
    connectSrc: [],
    frameSrc: [],
    fontSrc: certificateFontSources.fontSrc,
    mediaSrc: [],
    apiOrigin: null
  };
}
