import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  async function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // Redirect to login if token is invalid or user doesn't exist
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // Public routes that don't require authentication
    const publicRoutes = ['/login', '/pending', '/api/auth']
    if (publicRoutes.some(route => pathname.startsWith(route))) {
      return NextResponse.next()
    }

    // Redirect documents page to home for all users
    if (pathname.startsWith('/documents')) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    // Admin-only routes
    if (pathname.startsWith('/admin')) {
      if (token.role !== 'admin') {
        return NextResponse.redirect(new URL('/', req.url))
      }
      return NextResponse.next()
    }

    // If user is pending or rejected, only allow access to pending page
    if (token.status !== 'approved' && token.role !== 'admin') {
      // Allow access to pending page
      if (pathname === '/pending') {
        return NextResponse.next()
      }
      // Redirect to pending page for all other routes
      return NextResponse.redirect(new URL('/pending', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token
    },
    pages: {
      signIn: '/login',
      error: '/login'
    }
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
}
