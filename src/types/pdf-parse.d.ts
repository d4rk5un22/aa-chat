declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PDFData {
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
  }

  function pdf(dataBuffer: Buffer, options?: any): Promise<PDFData>;
  export = pdf;
}

declare module 'pdf-parse' {
  export * from 'pdf-parse/lib/pdf-parse.js';
}
