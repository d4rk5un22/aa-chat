import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession()
    console.log("DELETE /api/documents/[id] - Session:", session?.user ? {
      id: session.user.id,
      email: session.user.email
    } : "Not authenticated")

    if (!session?.user) {
      console.log("DELETE /api/documents/[id] - Unauthorized: No session or user")
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      )
    }

    const documentId = params.id
    if (!ObjectId.isValid(documentId)) {
      console.log("DELETE /api/documents/[id] - Invalid document ID:", documentId)
      return NextResponse.json(
        { message: "Invalid document ID" },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('ai-doc-chat')

    console.log("DELETE /api/documents/[id] - Connected to MongoDB, deleting document:", documentId)

    // First check if the document exists and belongs to the user
    const document = await db.collection("documents").findOne({
      _id: new ObjectId(documentId),
      userId: session.user.id
    })

    if (!document) {
      console.log("DELETE /api/documents/[id] - Document not found or not owned by user")
      return NextResponse.json(
        { message: "Document not found" },
        { status: 404 }
      )
    }

    // Delete the document
    const result = await db.collection("documents").deleteOne({
      _id: new ObjectId(documentId),
      userId: session.user.id
    })

    if (result.deletedCount === 0) {
      console.log("DELETE /api/documents/[id] - Failed to delete document")
      return NextResponse.json(
        { message: "Failed to delete document" },
        { status: 500 }
      )
    }

    console.log("DELETE /api/documents/[id] - Document deleted successfully")
    return NextResponse.json({ message: "Document deleted successfully" })
  } catch (error) {
    console.error("DELETE /api/documents/[id] - Error:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession()
    console.log("GET /api/documents/[id] - Session:", session?.user ? {
      id: session.user.id,
      email: session.user.email
    } : "Not authenticated")

    if (!session?.user) {
      console.log("GET /api/documents/[id] - Unauthorized: No session or user")
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      )
    }

    const documentId = params.id
    if (!ObjectId.isValid(documentId)) {
      console.log("GET /api/documents/[id] - Invalid document ID:", documentId)
      return NextResponse.json(
        { message: "Invalid document ID" },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('ai-doc-chat')

    console.log("GET /api/documents/[id] - Connected to MongoDB, fetching document:", documentId)

    const document = await db.collection("documents").findOne({
      _id: new ObjectId(documentId),
      userId: session.user.id
    })

    if (!document) {
      console.log("GET /api/documents/[id] - Document not found or not owned by user")
      return NextResponse.json(
        { message: "Document not found" },
        { status: 404 }
      )
    }

    // Transform MongoDB document to match Document interface
    const transformedDocument = {
      ...document,
      id: document._id.toString(),
      _id: undefined
    }

    console.log("GET /api/documents/[id] - Document found and returned")
    return NextResponse.json(transformedDocument)
  } catch (error) {
    console.error("GET /api/documents/[id] - Error:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}
