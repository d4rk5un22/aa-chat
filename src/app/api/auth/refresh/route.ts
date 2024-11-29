import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Trigger a session refresh
    const response = await fetch(new URL('/api/auth/session', req.url), { method: 'GET' })
    if (!response.ok) {
      throw new Error('Failed to refresh session')
    }

    return NextResponse.json({ message: 'Session refreshed successfully' })
  } catch (error) {
    console.error('Error refreshing session:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
