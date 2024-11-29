"use client"

import { useEffect, useRef, useState, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChatMessage } from "@/components/chat-message"
import type { Document } from "@/types/document"
import { useSearchParams } from "next/navigation"

interface Message {
  role: "user" | "assistant"
  content: string
}

function ChatContent() {
  const searchParams = useSearchParams()
  const documentId = searchParams.get("documentId")

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [documents, setDocuments] = useState<Document[]>([])
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [messageHistory, setMessageHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  // Load saved messages from localStorage
  useEffect(() => {
    const savedMessages = localStorage.getItem('chatMessages')
    const savedHistory = localStorage.getItem('messageHistory')
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages))
    }
    if (savedHistory) {
      setMessageHistory(JSON.parse(savedHistory))
    }
  }, [])

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('chatMessages', JSON.stringify(messages))
    }
  }, [messages])

  // Save message history to localStorage whenever it changes
  useEffect(() => {
    if (messageHistory.length > 0) {
      localStorage.setItem('messageHistory', JSON.stringify(messageHistory))
    }
  }, [messageHistory])

  useEffect(() => {
    if (documentId) {
      fetchDocument(documentId)
    } else {
      fetchDocuments()
    }
  }, [documentId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchDocument = async (id: string) => {
    try {
      const response = await fetch(`/api/documents/${id}`)
      if (!response.ok) throw new Error("Failed to fetch document")
      const data = await response.json()
      setDocuments([data])
    } catch (error) {
      console.error("Error fetching document:", error)
      setError("Failed to load document")
    }
  }

  const fetchDocuments = async () => {
    try {
      const response = await fetch("/api/documents")
      if (!response.ok) throw new Error("Failed to fetch documents")
      const data = await response.json()
      setDocuments(data)
    } catch (error) {
      console.error("Error fetching documents:", error)
      setError("Failed to load documents")
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || documents.length === 0) return

    const userMessage = input.trim()
    setInput("")
    setError(null)
    setMessages((prev) => [...prev, { role: "user", content: userMessage }])
    setIsLoading(true)
    setMessageHistory(prev => [...prev, userMessage])
    setHistoryIndex(-1)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          message: userMessage,
          documentIds: documents.map(doc => doc.id)
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.message || "Failed to send message")
      }

      const data = await response.json()
      if (!data.role || !data.content) {
        throw new Error("Invalid response format from API")
      }
      
      setMessages((prev) => [...prev, data])
    } catch (error) {
      console.error("Chat error:", error)
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault()
      if (historyIndex < messageHistory.length - 1) {
        const newIndex = historyIndex + 1
        setHistoryIndex(newIndex)
        setInput(messageHistory[messageHistory.length - 1 - newIndex])
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setInput(messageHistory[messageHistory.length - 1 - newIndex])
      } else if (historyIndex === 0) {
        setHistoryIndex(-1)
        setInput("")
      }
    }
  }

  const clearChat = () => {
    setMessages([])
    setMessageHistory([])
    localStorage.removeItem('chatMessages')
    localStorage.removeItem('messageHistory')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-900">
      {/* Fixed Sidebar with separate header */}
      <aside className="w-64 fixed top-[3.5rem] bottom-0 left-0 flex flex-col border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
        {/* Sidebar content */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-none p-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Available Documents</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="mb-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
              >
                <div className="font-medium text-gray-900 dark:text-gray-100">{doc.title}</div>
                <div className="text-sm text-gray-500">{doc.fileName}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 ml-64 flex flex-col h-[calc(100vh-3.5rem)]">
        {/* Fixed header */}
        <header className="flex-none h-[72px] border-b border-gray-200 dark:border-gray-800 flex items-center px-8 bg-white dark:bg-gray-900">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Chat with Documents</h1>
        </header>

        {/* Chat messages - only this should scroll */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-8">
            {messages.map((message, index) => (
              <ChatMessage 
                key={index} 
                role={message.role} 
                content={message.content} 
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input form */}
        <div className="sticky bottom-0 flex-none p-8 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="max-w-3xl mx-auto">
            {error && (
              <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex gap-4">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                disabled={isLoading || documents.length === 0}
                className="flex-1"
              />
              <Button type="submit" disabled={isLoading || documents.length === 0}>
                {isLoading ? "Sending..." : "Send"}
              </Button>
              <Button type="button" onClick={clearChat}>
                Clear Chat
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div>Loading chat...</div>}>
      <ChatContent />
    </Suspense>
  )
}
