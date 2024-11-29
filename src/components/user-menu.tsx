"use client"

import { signOut, useSession } from "next-auth/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"
import md5 from "crypto-js/md5"

export function UserMenu() {
  const { data: session } = useSession()

  if (!session?.user) {
    return (
      <Link href="/login">
        <Button variant="ghost">Sign In</Button>
      </Link>
    )
  }

  // Get Gravatar URL
  const getGravatarUrl = () => {
    if (!session.user.email) return ""
    const hash = md5(session.user.email.toLowerCase().trim())
    return `https://www.gravatar.com/avatar/${hash}?d=404&s=80`
  }

  // Get first letter of name or email for fallback
  const getFallbackInitial = () => {
    if (session.user.name) {
      return session.user.name.charAt(0).toUpperCase()
    }
    if (session.user.email) {
      return session.user.email.charAt(0).toUpperCase()
    }
    return "?"
  }

  const handleSignOut = async () => {
    await signOut({
      callbackUrl: "/login",
      redirect: true
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage 
              src={session.user.image || getGravatarUrl()} 
              alt={session.user.name || "User avatar"} 
            />
            <AvatarFallback>{getFallbackInitial()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{session.user.name || session.user.email}</p>
            {session.user.name && (
              <p className="text-xs leading-none text-muted-foreground">{session.user.email}</p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
