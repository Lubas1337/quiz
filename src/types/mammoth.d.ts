declare module 'mammoth' {
  interface ConversionOptions {
    arrayBuffer: ArrayBuffer;
  }

  interface ConversionMessage {
    type: string;
    message: string;
    path?: string[];
  }

  interface ConversionResult {
    value: string;
    messages: ConversionMessage[];
  }

  export function extractRawText(options: ConversionOptions): Promise<ConversionResult>;
} 