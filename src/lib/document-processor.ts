import { parsePDF } from "@/lib/pdf"
import OpenAI from 'openai'
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface DocumentChunk {
  content: string;
  embedding?: number[];
  metadata: {
    index: number;
    pageNumber?: number;
  };
}

export async function processDocument(
  file: Buffer,
  type: string
): Promise<{ 
  text: string; 
  chunks: DocumentChunk[];
  metadata: { 
    pages: number; 
    info: any;
    totalChunks: number;
  } 
}> {
  try {
    let text: string;
    let pages: number;
    let info: any;

    console.log("Processing document with type:", type)

    if (type === "application/pdf") {
      console.log("Processing PDF file...")
      const pdfData = await parsePDF(file)
      text = pdfData.text
      pages = pdfData.numpages
      info = pdfData.info
      console.log("PDF processed successfully")
    } else if (type === "text/plain") {
      console.log("Processing text file...")
      text = file.toString("utf-8")
      pages = 1
      info = null
      console.log("Text file processed successfully")
    } else {
      console.error("Unsupported file type:", type)
      throw new Error(`Unsupported file type: ${type}. Only PDF and text files are supported.`)
    }

    // Process chunks with embeddings
    const chunks = await processChunks(text)

    return {
      text,
      chunks,
      metadata: {
        pages,
        info,
        totalChunks: chunks.length
      }
    }
  } catch (error) {
    console.error("Error processing document:", error instanceof Error ? error.stack : error)
    throw new Error(
      error instanceof Error
        ? `Failed to process document: ${error.message}`
        : "Failed to process document"
    )
  }
}

async function processChunks(text: string, maxChunkSize = 1000): Promise<DocumentChunk[]> {
  try {
    if (!text) {
      console.log("No text to process into chunks")
      return []
    }

    console.log("Processing text into chunks, text length:", text.length)

    // Split text into chunks
    const textChunks = splitIntoChunks(text, maxChunkSize)
    console.log(`Split text into ${textChunks.length} chunks`)
    
    // Process chunks in larger batches
    const batchSize = 20 
    const processedChunks: DocumentChunk[] = []
    
    for (let i = 0; i < textChunks.length; i += batchSize) {
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(textChunks.length/batchSize)}`)
      const batch = textChunks.slice(i, i + batchSize)
      const batchPromises = batch.map(async (content, index) => {
        const chunkIndex = i + index
        try {
          const embedding = await generateEmbedding(content)
          return {
            content,
            embedding,
            metadata: {
              index: chunkIndex
            }
          }
        } catch (error) {
          console.error(`Error generating embedding for chunk ${chunkIndex}:`, error)
          // Retry once on failure
          try {
            console.log(`Retrying chunk ${chunkIndex}...`)
            const embedding = await generateEmbedding(content)
            return {
              content,
              embedding,
              metadata: {
                index: chunkIndex
              }
            }
          } catch (retryError) {
            console.error(`Retry failed for chunk ${chunkIndex}:`, retryError)
            return {
              content,
              metadata: {
                index: chunkIndex
              }
            }
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      processedChunks.push(...batchResults)
      
      // Reduced delay between batches
      if (i + batchSize < textChunks.length) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    console.log("Successfully processed all chunks with embeddings:", processedChunks.length)
    return processedChunks
  } catch (error) {
    console.error("Error processing chunks:", error)
    throw error
  }
}

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    })

    return response.data[0].embedding
  } catch (error) {
    console.error("Error generating embedding:", error)
    throw error
  }
}

function splitIntoChunks(text: string, maxChunkSize = 500): string[] {
  try {
    if (!text) {
      console.log("No text to split into chunks")
      return []
    }

    console.log("Splitting text into chunks, text length:", text.length)

    // Split by paragraphs first
    const paragraphs = text.split(/\n\s*\n/)
    const chunks: string[] = []
    let currentChunk: string[] = []
    let currentLength = 0

    for (const paragraph of paragraphs) {
      // Skip empty paragraphs
      if (!paragraph.trim()) continue

      const sentences = paragraph.split(/(?<=[.!?])\s+/)
      
      for (const sentence of sentences) {
        const sentenceLength = sentence.length

        // If single sentence is longer than maxChunkSize, split by words
        if (sentenceLength > maxChunkSize) {
          if (currentChunk.length > 0) {
            chunks.push(currentChunk.join(' '))
            currentChunk = []
            currentLength = 0
          }

          const words = sentence.split(/\s+/)
          let wordChunk: string[] = []
          let wordChunkLength = 0

          for (const word of words) {
            if (wordChunkLength + word.length + 1 > maxChunkSize && wordChunk.length > 0) {
              chunks.push(wordChunk.join(' '))
              wordChunk = []
              wordChunkLength = 0
            }
            wordChunk.push(word)
            wordChunkLength += word.length + 1
          }

          if (wordChunk.length > 0) {
            chunks.push(wordChunk.join(' '))
          }
          continue
        }

        // If adding this sentence would exceed maxChunkSize, create new chunk
        if (currentLength + sentenceLength + 1 > maxChunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk.join(' '))
          currentChunk = []
          currentLength = 0
        }

        currentChunk.push(sentence)
        currentLength += sentenceLength + 1
      }

      // Add paragraph break if we're continuing the same chunk
      if (currentChunk.length > 0 && currentLength + 2 <= maxChunkSize) {
        currentChunk.push('\n\n')
        currentLength += 2
      } else if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '))
        currentChunk = []
        currentLength = 0
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '))
    }

    console.log(`Created ${chunks.length} chunks with max size ${maxChunkSize}`)
    return chunks.map(chunk => chunk.trim()).filter(chunk => chunk.length > 0)
  } catch (error) {
    console.error("Error splitting text into chunks:", error)
    throw error
  }
}

export async function getChunksForDocument(documentId: string): Promise<DocumentChunk[]> {
  try {
    const client = await clientPromise
    const db = client.db('ai-doc-chat')
    
    // Get the document chunks
    const chunks = await db
      .collection("chunks")
      .find({ documentId: new ObjectId(documentId) })
      .sort({ "metadata.index": 1 })
      .toArray()

    return chunks.map(chunk => ({
      content: chunk.content,
      embedding: chunk.embedding,
      metadata: chunk.metadata
    }))
  } catch (error) {
    console.error("Error getting chunks for document:", error)
    throw error
  }
}
