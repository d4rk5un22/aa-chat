import { NextRequest, NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { getChunksForDocument } from "@/lib/document-processor"
import OpenAI from 'openai'
import { encode } from 'gpt-tokenizer'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const SIMILARITY_THRESHOLD = 0.7

async function calculateCosineSimilarity(embedding1: number[], embedding2: number[]): Promise<number> {
  if (!embedding1 || !embedding2) return 0
  
  const dotProduct = embedding1.reduce((sum, value, i) => sum + value * embedding2[i], 0)
  const magnitude1 = Math.sqrt(embedding1.reduce((sum, value) => sum + value * value, 0))
  const magnitude2 = Math.sqrt(embedding2.reduce((sum, value) => sum + value * value, 0))
  
  return dotProduct / (magnitude1 * magnitude2)
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Check if user is approved
    if (session.user.status !== 'approved' && session.user.role !== 'admin') {
      return new NextResponse('Account pending approval', { status: 403 })
    }

    const sessionAuth = await getAuthSession()
    if (!sessionAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { message, documentIds } = body

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: "At least one document ID is required" }, { status: 400 })
    }

    console.log("Processing chat request:", { message, documentIds })

    // Get query embedding
    const queryEmbedding = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: message,
    })

    // Fetch chunks for all selected documents
    const allChunks = await Promise.all(
      documentIds.map(async (docId) => {
        try {
          console.log("Fetching chunks for document:", docId)
          const chunks = await getChunksForDocument(docId)
          console.log(`Found ${chunks.length} chunks for document ${docId}`)
          return chunks
        } catch (error) {
          console.error(`Error fetching chunks for document ${docId}:`, error)
          return []
        }
      })
    )

    // Flatten all chunks into a single array
    let chunks = allChunks.flat()

    if (chunks.length === 0) {
      console.log("No chunks found for any documents")
      return NextResponse.json({ error: "No content found for the selected documents" }, { status: 404 })
    }

    console.log(`Total chunks found: ${chunks.length}`)

    // Calculate similarity scores and sort chunks
    const chunksWithScores = await Promise.all(
      chunks.map(async (chunk) => {
        const similarity = await calculateCosineSimilarity(
          queryEmbedding.data[0].embedding,
          chunk.embedding || []
        )
        return { ...chunk, similarity }
      })
    )

    // Sort by similarity and filter by threshold
    chunks = chunksWithScores
      .filter(chunk => chunk.similarity >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 15) // Increased from 5 to 15 chunks since we have more token capacity

    console.log(`Filtered to ${chunks.length} relevant chunks`)

    // Calculate total tokens in relevant chunks
    const chunkTokens = chunks.reduce((acc, chunk) => acc + encode(chunk.content).length, 0)
    console.log(`Total tokens in chunks: ${chunkTokens}`)

    // Build context from chunks while respecting token limit
    const MAX_CONTEXT_TOKENS = 50000 // Increased from 4000 to 25000
    let contextTokens = 0
    let contextText = ""

    for (const chunk of chunks) {
      const chunkTokenCount = encode(chunk.content).length
      if (contextTokens + chunkTokenCount > MAX_CONTEXT_TOKENS) {
        console.log(`Stopping at ${contextTokens} tokens to stay under ${MAX_CONTEXT_TOKENS} limit`)
        break
      }
      contextText += chunk.content + "\n\n"
      contextTokens += chunkTokenCount
    }

    console.log(`Final context length: ${contextTokens} tokens`)

    if (!contextText) {
      console.log("No relevant context found after filtering")
      return NextResponse.json({ error: "No relevant content found in the documents" }, { status: 404 })
    }

    console.log("Sending request to OpenAI with context length:", contextText.length, "tokens:", contextTokens)

    const completion = await openai.chat.completions.create({
      model: "gpt-4-1106-preview",
      messages: [
        {
          role: "system",
          content: "You are a helpful AI assistant that answers questions based on the provided context. Always be accurate and concise."
        },
        {
          role: "user",
          content: `Use the following context to answer the question. If you cannot answer the question based on the context, say so.

Context:
${contextText}

Question: ${message}

Answer:`
        }
      ],
      temperature: 0.5,
      max_tokens: 4000
    })

    const answer = completion.choices[0]?.message?.content || "Sorry, I couldn't generate a response."

    console.log("Generated response successfully")

    return NextResponse.json({
      role: "assistant",
      content: answer
    })

  } catch (error) {
    console.error("[CHAT_ERROR]", error)
    return NextResponse.json(
      { error: "An error occurred while processing your request" },
      { status: 500 }
    )
  }
}
