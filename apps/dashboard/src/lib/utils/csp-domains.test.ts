import { getCspDomains } from './csp-domains.js';

describe('getCspDomains', () => {
  it('allows the certificate font stylesheet and font files for self-hosted builds', () => {
    const domains = getCspDomains(true, undefined);

    expect(domains.styleSrc).toContain('https://fonts.googleapis.com');
    expect(domains.fontSrc).toContain('https://fonts.gstatic.com');
  });
});
