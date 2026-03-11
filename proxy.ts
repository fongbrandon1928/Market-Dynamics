import { NextResponse } from 'next/server'

export function proxy() {
  const contentSecurityPolicy = [
    "default-src 'self'",
    // Next.js app-router pages include framework inline scripts and static chunks.
    // Use a compatible script policy to avoid blocking hydration/runtime bundles.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')

  const response = NextResponse.next()

  response.headers.set('Content-Security-Policy', contentSecurityPolicy)
  ;['x-powered-by', 'server', 'x-aspnet-version', 'x-aspnetmvc-version'].forEach((header) => {
    response.headers.delete(header)
  })
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
