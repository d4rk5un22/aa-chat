import { NextAuthOptions, Session, getServerSession } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { MongoDBAdapter } from "@next-auth/mongodb-adapter"
import clientPromise from "./mongodb"
import { JWT } from "next-auth/jwt"

interface CustomSession extends Session {
  user: {
    id: string
    name: string
    email: string
    image: string
    role: 'admin' | 'user'
    status: 'pending' | 'approved' | 'rejected'
  }
}

interface UpdateSession {
  status?: 'pending' | 'approved' | 'rejected'
}

// List of admin email addresses
const ADMIN_EMAILS = [process.env.ADMIN_EMAIL].filter(Boolean) as string[]

export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "select_account"
        }
      }
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/auth/error',
    signOut: '/login'
  },
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/pending')) {
        return `${baseUrl}/pending`
      }
      // Maintain relative urls
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`
      }
      // Redirect to homepage if url is not relative
      return baseUrl
    },
    async signIn({ user, account, profile }) {
      if (!user?.email) return false

      const client = await clientPromise
      const db = client.db()

      // Check if user exists in users collection
      const dbUser = await db.collection('users').findOne({ email: user.email })
      const isAdmin = ADMIN_EMAILS.includes(user.email.toLowerCase())

      if (!dbUser) {
        // Create new user if doesn't exist
        const newUser = {
          email: user.email,
          name: user.name,
          image: user.image,
          role: isAdmin ? 'admin' : 'user',
          status: isAdmin ? 'approved' : 'pending',
          emailVerified: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
        const result = await db.collection('users').insertOne(newUser)
        
        // Create account link
        if (account && result.insertedId) {
          await db.collection('accounts').insertOne({
            userId: result.insertedId,
            type: account.type,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            refresh_token: account.refresh_token,
            access_token: account.access_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
            session_state: account.session_state,
          })
        }
      } else {
        // Update existing user
        await db.collection('users').updateOne(
          { email: user.email },
          {
            $set: {
              name: user.name,
              image: user.image,
              updatedAt: new Date()
            }
          }
        )

        // Check and update account link if needed
        if (account) {
          const existingAccount = await db.collection('accounts').findOne({
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          })

          if (!existingAccount) {
            await db.collection('accounts').insertOne({
              userId: dbUser._id,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              refresh_token: account.refresh_token,
              access_token: account.access_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
              session_state: account.session_state,
            })
          }
        }
      }

      return true
    },
    async session({ token, session }): Promise<CustomSession> {
      const client = await clientPromise
      const db = client.db()
      const dbUser = await db.collection('users').findOne({ email: token.email })
      
      if (!dbUser) {
        throw new Error('User not found')
      }

      return {
        ...session,
        user: {
          id: dbUser._id.toString(),
          name: dbUser.name || '',
          email: dbUser.email || '',
          image: dbUser.image || '',
          role: dbUser.role || 'user',
          status: dbUser.status || 'pending'
        },
        expires: session.expires
      }
    },
    async jwt({ token, user, account, trigger }) {
      if (trigger === 'signIn' && user) {
        const client = await clientPromise
        const db = client.db()
        const dbUser = await db.collection('users').findOne({ email: user.email })
        
        if (dbUser) {
          token.id = dbUser._id.toString()
          token.role = dbUser.role || 'user'
          token.status = dbUser.status || 'pending'
          token.email = dbUser.email
          token.name = dbUser.name
          token.picture = dbUser.image
        }
      }
      return token
    }
  },
  events: {
    async signIn({ user }) {
      console.log('Sign in event:', user)
    },
    async createUser({ user }) {
      console.log('Create user event:', user)
    }
  },
  debug: process.env.NODE_ENV === 'development',
}

export async function getAuthSession() {
  try {
    const session = await getServerSession(authOptions)
    console.log("Auth Session:", {
      found: !!session,
      user: session?.user ? {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
        status: session.user.status
      } : null
    })
    return session
  } catch (error) {
    console.error("Error getting auth session:", error)
    return null
  }
}
