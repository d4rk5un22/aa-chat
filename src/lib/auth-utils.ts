import { getServerSession } from "next-auth/next"
import { authOptions } from "./auth"

export async function isAdmin() {
  const session = await getServerSession(authOptions)
  return session?.user?.role === 'admin'
}

export async function requireAdmin() {
  if (!(await isAdmin())) {
    throw new Error('Unauthorized: Admin access required')
  }
}
