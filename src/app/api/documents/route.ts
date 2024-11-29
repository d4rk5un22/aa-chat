import { NextResponse, NextRequest } from "next/server"
import { getAuthSession } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import type { Document } from "@/types/document"
import { processDocument } from "@/lib/document-processor"
import { ObjectId } from "mongodb"
import { requireAdmin } from "@/lib/auth-utils"

// Force dynamic route handling
export const dynamic = 'force-dynamic'

// Handle GET request
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!session?.user) {
      console.log("GET /api/documents - Unauthorized: No session or user")
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      )
    }

    // Check if user is approved
    if (session.user.status !== 'approved' && session.user.role !== 'admin') {
      return NextResponse.json(
        { message: "Account pending approval" },
        { status: 403 }
      )
    }

    const client = await clientPromise
    const db = client.db('ai-doc-chat')

    console.log("GET /api/documents - Connected to MongoDB, fetching documents")

    const documents = await db.collection("documents")
      .find({})
      .sort({ createdAt: -1 })
      .toArray()

    // Transform MongoDB documents to match Document interface
    const transformedDocuments = documents.map(doc => ({
      id: doc._id.toString(),
      userId: doc.userId,
      title: doc.title,
      fileName: doc.fileName,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      text: doc.text,
      chunks: Array.isArray(doc.chunks) ? doc.chunks.map((chunk: { content: string }) => chunk.content) : [],
      metadata: doc.metadata,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    }))

    console.log("GET /api/documents - Found documents:", transformedDocuments.length)

    return NextResponse.json(transformedDocuments)
  } catch (error) {
    console.error("GET /api/documents - Error:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}

// Handle POST request
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()

    const session = await getAuthSession()
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Check if user is approved
    if (session.user.status !== 'approved' && session.user.role !== 'admin') {
      return NextResponse.json(
        { message: "Account pending approval" },
        { status: 403 }
      )
    }

    const formData = await req.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json(
        { message: "No file provided" },
        { status: 400 }
      )
    }

    // Check file type and size
    const fileType = file.type || 'application/pdf'
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { message: "File size exceeds 10MB limit" },
        { status: 400 }
      )
    }

    console.log("Processing document:", {
      fileName: file.name,
      fileType: fileType,
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`
    })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    console.log("Starting document processing...")
    const processedDoc = await processDocument(buffer, fileType)
    if (!processedDoc) {
      return NextResponse.json(
        { message: "Failed to process document" },
        { status: 500 }
      )
    }
    console.log("Document processed successfully")

    const client = await clientPromise
    const db = client.db('ai-doc-chat')

    // Store document metadata
    const doc = {
      userId: session.user.id,
      title: file.name.replace(/\.[^/.]+$/, ""),
      fileName: file.name,
      fileType: fileType,
      fileSize: file.size,
      text: processedDoc.text,
      metadata: processedDoc.metadata,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    console.log("Storing document in database...")
    const result = await db.collection("documents").insertOne(doc)
    const documentId = result.insertedId

    // Store chunks separately with document reference
    if (processedDoc.chunks.length > 0) {
      console.log(`Storing ${processedDoc.chunks.length} chunks in database...`)
      
      // Process chunks in batches for MongoDB
      const batchSize = 100
      for (let i = 0; i < processedDoc.chunks.length; i += batchSize) {
        const batchChunks = processedDoc.chunks
          .slice(i, i + batchSize)
          .map(chunk => ({
            ...chunk,
            documentId: documentId,
            userId: session.user.id,
            createdAt: new Date()
          }))

        console.log(`Storing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(processedDoc.chunks.length/batchSize)}...`)
        await db.collection("chunks").insertMany(batchChunks, { ordered: false })
      }
      
      console.log("All chunks stored successfully")

      // Create an index on embeddings if it doesn't exist
      console.log("Ensuring database indexes...")
      await db.collection("chunks").createIndex({ documentId: 1 })
      await db.collection("chunks").createIndex({ embedding: 1 }, { 
        background: true,
        sparse: true
      })
    }

    return NextResponse.json({
      id: documentId.toString(),
      message: "Document processed and stored successfully",
      metadata: processedDoc.metadata
    })

  } catch (error) {
    console.error("Error processing document upload:", error)
    return NextResponse.json(
      { 
        message: error instanceof Error ? error.message : "Internal server error",
        error: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
