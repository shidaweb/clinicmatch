import { SITE } from 'astrowind:config';

export const GET = () => {
  const siteUrl = SITE?.site?.replace(/\/$/, '');
  const lines = ['User-agent: *', 'Allow: /'];

  if (siteUrl) {
    lines.push(`Sitemap: ${siteUrl}/sitemap-index.xml`);
    lines.push(`Host: ${new URL(siteUrl).host}`);
  }

  return new Response(`${lines.join('\n')}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
