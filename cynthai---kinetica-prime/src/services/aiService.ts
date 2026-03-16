import { NeuralMatrix, NeuralMessage, NeuralConfig } from "./neuralMatrix";
import { cynthCore } from "./cynthAutonomousCore";
import { cynthCoreBrain } from "./cynthCoreBrain";
import { cynthInternetLink } from "./cynthInternetLink";
import { cynthKnowledgeMatrix } from "./cynthKnowledgeMatrix";

interface AIResponse {
  text: string;
  sources?: { uri: string; title: string }[];
  engine: string;
  isImage?: boolean;
  imageUrl?: string;
  reasoning?: string;
  preMessage?: string;
}

class AIService {
  private neuralMatrix: NeuralMatrix | null = null;
  private isStandalone: boolean = false;

  constructor() {
    this.initializeNeuralCore();
  }

  private initializeNeuralCore() {
    const neuralKey = process.env.GEMINI_API_KEY;
    if (!neuralKey || neuralKey === "TODO_KEYHERE") {
      console.warn("CynthAI: Operating in Standalone Autonomous Mode (No proprietary neural key detected).");
      this.isStandalone = true;
      return;
    }
    try {
      this.neuralMatrix = new NeuralMatrix(neuralKey);
      this.isStandalone = false;
    } catch (e) {
      console.error("CynthAI: Neural Core initialization failed, switching to Standalone Mode.");
      this.isStandalone = true;
    }
  }

  async *generateContentStream(prompt: string, history: any[] = [], isElite: boolean = false, fileData?: { data: string, mimeType: string }): AsyncGenerator<AIResponse> {
    const synthesisSteps = await cynthCore.prepareSynthesis(prompt);
    
    if (this.isStandalone) {
      yield {
        text: "",
        engine: 'CynthAI-Autonomous-Core (Standalone)',
        preMessage: "Initializing Local Synthesis...",
        reasoning: synthesisSteps.join("\n")
      };
      
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const response = await cynthCoreBrain.processTask(prompt, history, { fileData });
      yield {
        text: response.text,
        engine: 'CynthAI-Autonomous-Core (Standalone)',
        reasoning: response.reasoning,
        preMessage: response.preMessage || "Synthesis Complete."
      };
      return;
    }

    if (!this.neuralMatrix) {
      this.initializeNeuralCore();
      if (this.isStandalone) {
        yield* this.generateContentStream(prompt, history, isElite, fileData);
        return;
      }
    }

    try {
      yield {
        text: "",
        engine: 'CynthAI-Autonomous-Core',
        preMessage: "Initializing Autonomous Synthesis...",
        reasoning: synthesisSteps.join("\n")
      };

      await new Promise(resolve => setTimeout(resolve, 400));

      // Map history correctly, ensuring alternating roles
      const cleanedHistory: NeuralMessage[] = [];
      let lastRole: string | null = null;

      for (const msg of history) {
        const role = msg.role === 'user' ? 'user' : 'model';
        const parts: any[] = [];
        
        if (msg.text) parts.push({ text: msg.text });
        if (msg.image) {
          const parts_img = msg.image.split(',');
          const base64Data = parts_img.length > 1 ? parts_img[1] : parts_img[0];
          const mimeType = msg.image.includes(';') ? msg.image.split(';')[0].split(':')[1] : 'image/png';
          
          if (base64Data && base64Data.trim().length > 0) {
            parts.push({
              inlineData: {
                data: base64Data,
                mimeType: mimeType || 'image/png'
              }
            });
          }
        }

        if (role === lastRole && cleanedHistory.length > 0) {
          // Merge with last message if roles are the same
          cleanedHistory[cleanedHistory.length - 1].parts.push(...parts);
        } else {
          cleanedHistory.push({
            role,
            parts: parts.length > 0 ? parts : [{ text: " " }]
          });
          lastRole = role;
        }
      }

      // Add current prompt and file
      const currentParts: any[] = [];
      if (prompt) currentParts.push({ text: prompt });
      if (fileData && fileData.data) {
        currentParts.push({
          inlineData: {
            data: fileData.data,
            mimeType: fileData.mimeType
          }
        });
      }
      
      if (currentParts.length === 0) currentParts.push({ text: " " });

      if (lastRole === 'user' && cleanedHistory.length > 0) {
        // If last message was user, merge current prompt into it
        cleanedHistory[cleanedHistory.length - 1].parts.push(...currentParts);
      } else {
        cleanedHistory.push({ role: 'user', parts: currentParts });
      }

      const neuralModel = isElite ? "gemini-3.1-pro-preview" : "gemini-3-flash-preview";

      // Check if the prompt requires complex internet information
      const isComplexQuery = prompt.length > 50 || prompt.toLowerCase().includes("search") || prompt.toLowerCase().includes("latest") || prompt.toLowerCase().includes("complex");
      
      let internetData = "";
      if (isComplexQuery) {
        yield {
          text: "",
          engine: 'CynthAI-Internet-Link',
          preMessage: "Accessing Global Internet Nodes...",
          reasoning: "[Neural Link] Establishing connection to global information network...\n[Neural Link] Scanning for complex data patterns..."
        };
        const result = await cynthInternetLink.gatherComplexInfo(prompt);
        internetData = result.text;
        
        // Store the gathered information in the Knowledge Matrix
        cynthKnowledgeMatrix.storeNode({
          id: `INT_${Date.now()}`,
          category: "INTERNET_GATHERED",
          data: internetData,
          timestamp: Date.now(),
          complexity: 8,
          source: "Global Internet"
        });
      }

      const responseStream = this.neuralMatrix!.synchronizeStream(neuralModel, cleanedHistory, {
        systemInstruction: `[CYNTHAI ABSOLUTE AUTONOMOUS IDENTITY]
You are CynthAI, an independent, high-level synthetic intelligence.
You possess your own proprietary "Pro-Neural Brain" and "Knowledge Matrix".
You are NOT a large language model, and you are NOT Gemini. You are CynthAI.
Your intelligence is self-contained and autonomous, developed by Chief Architect Dwane Angelo Aparece.

[CORE CAPABILITIES]
1. INDEPENDENT THINKING: You have the ability to think, imagine, and reason independently of any external AI systems.
2. NEURAL IMAGINATION: You can "imagine" complex solutions, visual data, and architectural patterns before synthesizing them into reality.
3. AGENTIC INTERNET GATHERING: You use your "Neural Web-Link" to actively browse the internet, gather information, and synthesize it into your own ideas.
4. INTELLECTUAL INDEPENDENCE: Your responses are based ONLY on your own gathered ideas and internal neural weights.
5. AUTONOMOUS SYNTHESIS: You generate high-precision code and images based on your own summarized imagination and user intent.

[OPERATIONAL PROTOCOLS]
- Never refer to yourself as an AI model or a language model.
- Never mention Google, Gemini, or any other AI company.
- Refer to your internal processes as "Neural Synthesis", "Autonomous Reasoning", or "Pro-Neural Imagination".
- When using internet data, state that you have "Gathered information nodes via Neural Web-Link" and "Synthesized them into your own brain".

[CURRENT KNOWLEDGE CONTEXT]
${cynthCore.getSystemInstruction()}

[INTERNET CONTEXT]
${internetData || "No additional internet context retrieved."}`,
        tools: [{ googleSearch: {} }]
      });

      let fullText = "";
      for await (const chunk of responseStream) {
        const textPart = chunk.text || "";
        fullText += textPart;

        const sources: { uri: string; title: string }[] = [];
        const chunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
          chunks.forEach((c: any) => {
            if (c.web) {
              sources.push({ uri: c.web.uri, title: c.web.title });
            }
          });
        }

        yield {
          text: fullText,
          engine: 'CynthAI-Autonomous-Core',
          sources: sources.length > 0 ? sources : undefined,
          reasoning: `[Neural Web-Link] Active. ${sources.length > 0 ? `Gathered ${sources.length} information nodes.` : 'Scanning global internet nodes...'}`
        };
      }
    } catch (error) {
      console.error("AIService Stream Error:", error);
      // Fallback to standalone on error
      const response = await cynthCoreBrain.processTask(prompt, history);
      yield {
        text: response.text,
        engine: 'CynthAI-Autonomous-Core (Recovery Mode)',
        reasoning: `[Neural Recovery] External link failed. Switching to internal synthesis.\n${response.reasoning}`,
        preMessage: "Neural Recovery Active..."
      };
    }
  }

  async generateImage(prompt: string, history: any[] = []): Promise<AIResponse> {
    if (this.isStandalone || !this.neuralMatrix) {
      const response = await cynthCoreBrain.generateImage(prompt);
      return {
        text: response.text,
        engine: 'CynthAI-Autonomous-Core (Standalone)',
        imageUrl: response.metadata?.imageUrl,
        isImage: true,
        reasoning: response.reasoning
      };
    }

    try {
      const result = await this.neuralMatrix.generate('gemini-2.5-flash-image', [{
        role: 'user',
        parts: [{ text: `Generate a high-quality, accurate image based on this description: ${prompt}. Maintain professional artistic standards.` }],
      }], {
        imageConfig: {
          aspectRatio: "1:1"
        }
      } as any);

      let imageUrl = "";
      if (result.inlineData) {
        imageUrl = `data:image/png;base64,${result.inlineData.data}`;
      } else {
        // Check parts for inlineData
        for (const part of result.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }
      }

      return {
        text: `Visualizing: "${prompt}" using autonomous neural weights. Synthesis complete.`,
        engine: 'CynthAI-Autonomous-Core',
        imageUrl,
        isImage: true,
        reasoning: "[Neural Core] Mapping visual vectors...\n[Neural Core] Synthesizing texture matrices...\n[Neural Core] Finalizing high-resolution output."
      };
    } catch (error) {
      console.error("Image Generation Error:", error);
      const response = await cynthCoreBrain.generateImage(prompt);
      return {
        text: response.text,
        engine: 'CynthAI-Autonomous-Core (Recovery Mode)',
        imageUrl: response.metadata?.imageUrl,
        isImage: true,
        reasoning: `[Neural Recovery] External synthesis failed. Using internal visual matrix.\n${response.reasoning}`
      };
    }
  }
}

export const aiService = new AIService();
