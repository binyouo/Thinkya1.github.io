import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://binzi.top'}/sitemap.xml`,
    rules: [
      {
        userAgent: '*',
        disallow: ['/login/', '/preview/', '/dashboard', '/_next'],
      },
    ],
  }
}
