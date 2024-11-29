import pdfParse from 'pdf-parse/lib/pdf-parse.js'

export async function parsePDF(buffer: Buffer) {
  return pdfParse(buffer)
}
