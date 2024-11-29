import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      image: string
      role: 'admin' | 'user'
      status: 'pending' | 'approved' | 'rejected'
    }
  }

  interface User {
    id: string
    name: string
    email: string
    image: string
    role: 'admin' | 'user'
    status: 'pending' | 'approved' | 'rejected'
    provider?: string
    providerAccountId?: string
    createdAt: Date
    updatedAt: Date
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub: string
    name: string
    email: string
    picture: string
    role: 'admin' | 'user'
    status: 'pending' | 'approved' | 'rejected'
    provider?: string
    providerAccountId?: string
  }
}
