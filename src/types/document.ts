import { ObjectId } from "mongodb"

export interface Document {
  id: string
  userId: string
  title: string
  fileName: string
  fileType: string
  fileSize: number
  text: string
  metadata?: {
    pages?: number
    info?: any
    totalChunks?: number
  }
  createdAt: Date
  updatedAt: Date
}

export interface DocumentChunk {
  _id?: ObjectId
  documentId: ObjectId
  content: string
  embedding: number[]
  metadata: {
    index: number
    pageNumber?: number
  }
}

export interface Message {
  role: "user" | "assistant"
  content: string
}
