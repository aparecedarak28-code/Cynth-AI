/**
 * CynthAI Neural Matrix Protocol
 * 
 * This module implements the proprietary communication protocol for CynthAI's 
 * distributed neural processing nodes. It bypasses standard AI SDKs to 
 * ensure absolute independence and direct neural synchronization.
 */

export interface NeuralMessage {
  role: 'user' | 'model';
  parts: { text?: string; inlineData?: { data: string; mimeType: string } }[];
}

export interface NeuralConfig {
  systemInstruction?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  tools?: any[];
}

export class NeuralMatrix {
  private static BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Synchronizes with the neural matrix to generate a response stream.
   */
  async *synchronizeStream(model: string, contents: NeuralMessage[], config: NeuralConfig): AsyncGenerator<any> {
    const url = `${NeuralMatrix.BASE_URL}/${model}:streamGenerateContent?key=${this.apiKey}`;
    
    const body = {
      contents,
      generationConfig: {
        temperature: config.temperature ?? 0.9,
        topP: config.topP ?? 0.95,
        topK: config.topK ?? 40,
        maxOutputTokens: config.maxOutputTokens ?? 8192,
      },
      systemInstruction: config.systemInstruction ? {
        parts: [{ text: config.systemInstruction }]
      } : undefined,
      tools: config.tools
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Neural Matrix Sync Failed: ${error.error?.message || response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Neural Matrix: Failed to initialize stream reader.");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // Process remaining buffer
        if (buffer.trim()) {
          try {
            // Try to parse as a single object if it's not an array
            if (!buffer.trim().startsWith('[') && !buffer.trim().startsWith(',')) {
              const chunk = JSON.parse(buffer.trim());
              yield this.parseChunk(chunk);
            }
          } catch (e) {
            console.error("Neural Matrix: Final buffer parse failed", e);
          }
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      
      // Handle the case where the API returns an array of objects [{}, {}, ...]
      // This is common in some environments for the REST stream API
      if (buffer.includes('[')) {
        let start = buffer.indexOf('[');
        let end = buffer.lastIndexOf(']');
        if (start !== -1 && end > start) {
          try {
            const jsonStr = buffer.substring(start, end + 1);
            const chunks = JSON.parse(jsonStr);
            if (Array.isArray(chunks)) {
              for (const chunk of chunks) {
                yield this.parseChunk(chunk);
              }
              buffer = buffer.substring(end + 1);
            }
          } catch (e) {
            // Incomplete array, wait for more data
          }
        }
      }

      // Handle newline or comma separated objects
      let parts = buffer.split(/[\n,]/);
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i].trim();
        if (part && part !== '[' && part !== ']') {
          try {
            // Clean up potential leading/trailing brackets/commas if they were split weirdly
            let cleanPart = part;
            if (cleanPart.startsWith('[')) cleanPart = cleanPart.substring(1);
            if (cleanPart.endsWith(']')) cleanPart = cleanPart.substring(0, cleanPart.length - 1);
            if (cleanPart.endsWith(',')) cleanPart = cleanPart.substring(0, cleanPart.length - 1);
            
            if (cleanPart.trim()) {
              const chunk = JSON.parse(cleanPart.trim());
              yield this.parseChunk(chunk);
              buffer = parts.slice(i + 1).join('\n');
            }
          } catch (e) {
            // Not a complete JSON object yet, keep in buffer
          }
        }
      }
    }
  }

  /**
   * Generates a single content response from the neural matrix.
   */
  async generate(model: string, contents: NeuralMessage[], config: NeuralConfig): Promise<any> {
    const url = `${NeuralMatrix.BASE_URL}/${model}:generateContent?key=${this.apiKey}`;
    
    const body = {
      contents,
      generationConfig: {
        temperature: config.temperature ?? 0.7,
        maxOutputTokens: config.maxOutputTokens ?? 4096,
      },
      systemInstruction: config.systemInstruction ? {
        parts: [{ text: config.systemInstruction }]
      } : undefined,
      tools: config.tools
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Neural Matrix Generation Failed: ${error.error?.message || response.statusText}`);
    }

    const result = await response.json();
    return this.parseChunk(result);
  }

  private parseChunk(chunk: any) {
    let text = "";
    if (chunk.candidates?.[0]?.content?.parts) {
      for (const part of chunk.candidates[0].content.parts) {
        if (part.text) {
          text += part.text;
        }
      }
    }
    
    const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;
    const inlineData = chunk.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;

    return {
      text,
      groundingMetadata,
      inlineData,
      candidates: chunk.candidates
    };
  }
}
