"use client"

import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"

interface ChatMessageProps {
  role: "user" | "assistant"
  content: string
  isLoading?: boolean
}

export function ChatMessage({ role, content, isLoading }: ChatMessageProps) {
  const { data: session } = useSession()
  const userInitial = session?.user?.name?.charAt(0) || "U"

  return (
    <div
      className={cn(
        "group w-full text-gray-800 dark:text-gray-100 border-b border-black/10 dark:border-gray-900/50",
        role === "assistant" ? "bg-gray-50 dark:bg-gray-800/50" : "bg-white dark:bg-gray-900"
      )}
    >
      <div className="text-base gap-4 md:gap-6 md:max-w-2xl lg:max-w-[38rem] xl:max-w-3xl p-4 md:py-6 lg:px-0 m-auto">
        <div className="flex flex-1 gap-4 text-base mx-auto md:gap-6">
          <div className="flex-shrink-0 flex flex-col relative items-end">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-sm text-white text-sm",
                role === "user" ? "bg-blue-600" : "bg-green-600"
              )}
            >
              {role === "user" ? userInitial : "AI"}
            </div>
          </div>
          <div className="flex flex-col w-[calc(100%-50px)]">
            <div className="flex-1 gap-3">
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]"></div>
                  <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]"></div>
                  <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-400"></div>
                </div>
              ) : (
                <div className="prose dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-100">{content}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
