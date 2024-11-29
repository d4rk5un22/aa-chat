"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText } from "lucide-react"
import type { Document } from "@/types/document"
import Link from "next/link"
import { useSession } from "next-auth/react"

interface DocumentListProps {
  documents: Document[]
  onDocumentDeleted: () => void
}

export function DocumentList({ documents, onDocumentDeleted }: DocumentListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { data: session } = useSession()

  const handleDelete = async (id: string) => {
    if (!id) {
      console.error("Cannot delete document: ID is undefined")
      return
    }

    setDeletingId(id)
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to delete document")
      }

      onDocumentDeleted()
    } catch (error) {
      console.error("Error deleting document:", error)
    } finally {
      setDeletingId(null)
    }
  }

  if (!documents.length) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        No documents uploaded yet
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {documents.map((doc) => {
        // Skip rendering if doc or doc.id is undefined
        if (!doc || !doc.id) {
          console.warn("Document or document ID is undefined:", doc)
          return null
        }

        return (
          <div key={doc.id}>
            <Card className="p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <Link href={`/chat?documentId=${doc.id}`} className="flex-1">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-primary/10 rounded">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium truncate">{doc.title}</h3>
                      </div>
                      
                      <div className="mt-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          {[
                            { key: 'size', content: formatFileSize(doc.fileSize) },
                            { key: 'dot1', content: '•' },
                            { key: 'filename', content: doc.fileName },
                            { key: 'dot2', content: '•' },
                            { key: 'date', content: formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true }) }
                          ].map((item) => (
                            <span key={`${doc.id}-${item.key}`}>{item.content}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>

                {session?.user?.role === 'admin' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(doc.id)}
                    disabled={deletingId === doc.id}
                    className="flex-shrink-0"
                  >
                    {deletingId === doc.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    ) : (
                      "Delete"
                    )}
                  </Button>
                )}
              </div>
            </Card>
          </div>
        )
      })}
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
