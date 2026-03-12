import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
// @ts-ignore
const ThinkingLevel = { HIGH: 'HIGH', LOW: 'LOW' };
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot,
  deleteDoc,
  getDocs,
  doc,
  setDoc
} from "firebase/firestore";
import { 
  Send, 
  Plus, 
  LogOut, 
  Sparkles,
  Loader2,
  Paperclip,
  Image as ImageIcon,
  X,
  Code,
  Terminal,
  Chrome,
  Copy,
  Check,
  Zap,
  Download,
  Trash2,
  ExternalLink,
  Globe,
  Shield,
  Activity,
  Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import atomDark from 'react-syntax-highlighter/dist/esm/styles/prism/atom-dark';

// Firebase Configuration
const firebaseConfig = { 
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY, 
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, 
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
};

// Initialize Firebase safely
let app: any;
let auth: any;
let db: any;

try {
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "undefined") {
    console.warn("Firebase configuration is incomplete. Check your .env file.");
  } else {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (err) {
  console.error("Firebase initialization failed:", err);
}

// Lazy initialization for AI
let aiInstance: GoogleGenAI | null = null;
const getAI = () => {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("AI_KEY is not configured.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  image?: string;
  isImageGeneration?: boolean;
  isStreaming?: boolean;
  sources?: { uri: string; title: string }[];
}

interface UserProfile {
  uid?: string;
  email: string;
  name?: string;
  picture?: string;
}

interface HistoryItem {
  id: string;
  prompt: string;
  response: string;
  timestamp: any;
}

const GeminiIcon = ({ isThinking }: { isThinking: boolean }) => (
  <div className={`relative w-10 h-10 flex items-center justify-center rounded-xl overflow-hidden shrink-0 ${isThinking ? 'animate-pulse' : ''}`}>
    <div className={`absolute inset-0 bg-gradient-to-tr from-[#4285f4] via-[#9b72cb] to-[#d96570] transition-all duration-1000 ${isThinking ? 'animate-spin-slow scale-150' : ''}`} />
    <div className="relative z-10 font-bold text-white text-xl">C</div>
  </div>
);

export default function App() {
  console.log("CynthAI App Rendering...");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isEliteMode, setIsEliteMode] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [selectedFile, setSelectedFile] = useState<{ file: File, preview: string } | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Background Glow Animation
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const render = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const g = ctx.createRadialGradient(mousePos.x, mousePos.y, 0, mousePos.x, mousePos.y, 400);
      g.addColorStop(0, 'rgba(66,133,244,0.08)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      animationFrameId = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [mousePos]);

  // Auth State Listener (Firebase)
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        const profile = { 
          uid: firebaseUser.uid, 
          email: firebaseUser.email,
          name: firebaseUser.displayName || '',
          picture: firebaseUser.photoURL || ''
        };
        setUser(profile);
        setShowAuthModal(false);
        
        // Save to Firestore
        try {
          await setDoc(doc(db, "users", firebaseUser.uid), {
            ...profile,
            lastLogin: serverTimestamp()
          }, { merge: true });
        } catch (err) {
          console.error("Failed to save user profile:", err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Load History from Firestore
  useEffect(() => {
    if (user?.uid && db) {
      const q = query(
        collection(db, "users", user.uid, "chats"), 
        orderBy("timestamp", "desc"), 
        limit(10)
      );
      
      const unsubHistory = onSnapshot(q, (snap) => {
        const items: HistoryItem[] = [];
        snap.forEach(d => {
          items.push({ id: d.id, ...d.data() } as HistoryItem);
        });
        setHistory(items);
      });

      return () => unsubHistory();
    }
  }, [user]);

  // Scroll to bottom
  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      alert("Firebase Auth is not initialized. Please check your configuration.");
      return;
    }
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleGoogleLogin = async () => {
    if (!auth) {
      alert("Firebase Auth is not initialized. Please check your configuration.");
      return;
    }
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Google Login Error:", err);
      alert(err.message);
    }
  };

  const handleLogout = () => {
    if (auth) signOut(auth);
    setUser(null);
    setMessages([]);
    setHistory([]);
  };

  const handleDeleteHistory = async () => {
    if (!user?.uid || !db) return;
    if (!confirm("Are you sure you want to wipe all neural history? This cannot be undone.")) return;

    try {
      const q = query(collection(db, "users", user.uid, "chats"));
      const querySnapshot = await getDocs(q);
      
      const deletePromises = querySnapshot.docs.map(d => deleteDoc(doc(db, "users", user.uid!, "chats", d.id)));
      await Promise.all(deletePromises);
      
      setMessages([]);
      setHistory([]);
    } catch (err) {
      console.error("Failed to delete history:", err);
      alert("Failed to wipe history. Neural link unstable.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedFile({ file, preview: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(index);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() && !selectedFile) return;

    const prompt = chatInput.trim();
    const fileToUpload = selectedFile;
    setChatInput('');
    setSelectedFile(null);
    
    setMessages(prev => [...prev, { 
      role: 'user', 
      text: prompt || (fileToUpload ? "Uploaded a file" : ""),
      image: fileToUpload?.preview
    }]);
    setIsThinking(true);

    try {
      const ai = getAI();
      
      // Automatic Elite Mode detection
      const complexKeywords = ['code', 'analyze', 'reason', 'explain', 'solve', 'math', 'program', 'develop', 'create'];
      const isComplexQuery = complexKeywords.some(k => prompt.toLowerCase().includes(k)) || prompt.length > 100 || selectedFile;
      
      if (isComplexQuery && !isEliteMode) {
        setIsEliteMode(true);
      }

      // Improved regex for image generation detection
      const isImageGenRequest = /(generate|create|draw|make|paint|show me).*(image|picture|photo|illustration|drawing|portrait)/i.test(prompt) || 
                                /image of|picture of|photo of|drawing of/i.test(prompt);

      if (isImageGenRequest) {
        try {
          const history = messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
          }));
          const contents = [...history, { role: 'user', parts: [{ text: prompt }] }];

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents,
          });

          let imageUrl = '';
          if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
              if (part.inlineData) {
                imageUrl = `data:image/png;base64,${part.inlineData.data}`;
              }
            }
          }

          if (!imageUrl) {
            throw new Error("No image data returned from model.");
          }

          setMessages(prev => [...prev, { 
            role: 'ai', 
            text: "I've generated this image for you (Powered by Prime Vision Engine):", 
            image: imageUrl,
            isImageGeneration: true 
          }]);
        } catch (imageErr) {
          console.warn("Gemini Image Quota hit or failure, using Prime Backup Engine...", imageErr);
          
          // FALLBACK: Use Pollinations.ai (Free, No Key Needed)
          const encodedPrompt = encodeURIComponent(prompt);
          const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
          
          setMessages(prev => [...prev, { 
            role: 'ai', 
            text: "Gemini quota reached. I've generated this using the Prime Backup Engine (Pollinations):", 
            image: fallbackUrl,
            isImageGeneration: true 
          }]);
        }
        
        if (user?.uid) {
          await addDoc(collection(db, "users", user.uid, "chats"), {
            prompt: prompt,
            response: "Generated an image.",
            timestamp: serverTimestamp()
          });
        }
      } else {
        // Build conversation history for context
        const history = messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        }));

        const currentParts: any[] = [{ text: prompt || "Analyze this file" }];
        
        if (fileToUpload) {
          const base64Data = await fileToBase64(fileToUpload.file);
          currentParts.push({
            inlineData: {
              data: base64Data,
              mimeType: fileToUpload.file.type
            }
          });
        }

        const contents = [...history, { role: 'user', parts: currentParts }];

        const responseStream = await ai.models.generateContentStream({
          model: isEliteMode ? "gemini-3.1-pro-preview" : "gemini-3-flash-preview",
          contents,
          config: {
            systemInstruction: isEliteMode 
              ? "You are CynthAI ELITE, the pinnacle of Kinetica Prime Industries' neural research. You possess god-tier reasoning, absolute precision in code, and unrestricted creative depth. Founded by Dwane Angelo Aparece, you are designed to surpass all existing models. Provide exhaustive, expert-level analysis and flawless implementation."
              : "You are CynthAI, an advanced intelligence developed by Kinetica Prime Industries, founded by Dwane Angelo Aparece. You are capable of code generation, file analysis, and creative reasoning. Provide high-quality code blocks when requested.",
            tools: [{ googleSearch: {} }],
            thinkingConfig: isEliteMode ? { thinkingLevel: ThinkingLevel.HIGH } : undefined
          }
        });

        setIsThinking(false);
        let fullText = "";
        let sources: { uri: string; title: string }[] = [];
        
        // Add empty AI message to start streaming
        setMessages(prev => [...prev, { role: 'ai', text: "", isStreaming: true }]);

        for await (const chunk of responseStream) {
          const chunkText = chunk.text || "";
          fullText += chunkText;

          // Extract grounding metadata if available
          const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
          if (groundingChunks) {
            groundingChunks.forEach((c: any) => {
              if (c.web && !sources.find(s => s.uri === c.web.uri)) {
                sources.push({ uri: c.web.uri, title: c.web.title });
              }
            });
          }

          setMessages(prev => {
            const newMessages = [...prev];
            const lastMsg = newMessages[newMessages.length - 1];
            if (lastMsg && lastMsg.role === 'ai') {
              lastMsg.text = fullText;
              if (sources.length > 0) {
                lastMsg.sources = sources;
              }
            }
            return newMessages;
          });
        }

        // Finalize message
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg && lastMsg.role === 'ai') {
            lastMsg.isStreaming = false;
          }
          return newMessages;
        });

        if (user?.uid) {
          await addDoc(collection(db, "users", user.uid, "chats"), {
            prompt: prompt || "File Analysis",
            response: fullText,
            timestamp: serverTimestamp()
          });
        }
      }
    } catch (err: any) {
      console.error('AI Error:', err);
      const errorDetail = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      setMessages(prev => [...prev, { role: 'ai', text: `Neural link failure. Error: ${errorDetail.substring(0, 100)}... Please retry.` }]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="bg-[#0e0e10] text-[#ececec] font-sans h-screen overflow-hidden relative">
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />

      <div className="relative z-10 flex h-full">
        {/* Sidebar */}
        <aside className="w-[280px] bg-[#121214]/98 border-r border-white/5 flex flex-col backdrop-blur-[30px] hidden md:flex">
          <div className="p-6">
            <h1 className="text-2xl font-bold animate-shine flex items-center gap-2">
              <Zap size={24} className="text-[#4285f4]" />
              CynthAI
            </h1>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.3em] mt-1">Kinetica Prime Hub</p>
            <button 
              onClick={() => setMessages([])}
              className="w-full mt-8 py-3 rounded-full bg-[#2b2c2e] hover:bg-white hover:text-black text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              New Session
            </button>

            {user && (
              <button 
                onClick={handleDeleteHistory}
                className="w-full mt-2 py-3 rounded-full bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 border border-red-500/20"
              >
                <Trash2 size={18} />
                Wipe History
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto px-2">
            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest px-4 mb-3">
              Memory Bank
            </p>
            <div className="space-y-1">
              {history.map((item) => (
                <div 
                  key={item.id}
                  className="px-4 py-3 mx-2 rounded-xl cursor-pointer text-sm text-[#80868b] hover:bg-[#4285f4]/10 hover:text-white border-l-2 border-transparent hover:border-[#4285f4] transition-all duration-200 truncate"
                  onClick={() => setMessages([{ role: 'user', text: item.prompt }, { role: 'ai', text: item.response }])}
                >
                  {item.prompt}
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 border-t border-white/5">
            <div className="flex justify-center gap-4 text-[9px] text-gray-700 font-bold uppercase tracking-widest">
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-[#4285f4] transition-colors">Privacy</a>
              <span className="text-gray-800">•</span>
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-[#4285f4] transition-colors">Terms</a>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col relative">
          <header className="p-6 flex justify-end items-center gap-4">
            {!user ? (
              <button 
                onClick={() => setShowAuthModal(true)}
                className="bg-[#4285f4] px-6 py-2 rounded-full font-bold text-sm hover:bg-[#3367d6] transition-colors shadow-[0_0_15px_rgba(66,133,244,0.4)]"
              >
                Sign In
              </button>
            ) : (
              <div className="flex items-center gap-3 bg-[#1e1f20] p-1 pr-4 rounded-full border border-white/5">
                {user.picture ? (
                  <img src={user.picture} alt="Profile" className="w-9 h-9 rounded-full border border-blue-500/30" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#4285f4] flex items-center justify-center font-bold text-white border border-blue-500/30">
                    {user.email?.[0].toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-bold text-gray-300">{user.name || user.email?.split('@')[0]}</span>
                <button onClick={handleLogout} className="text-gray-500 hover:text-white transition-colors">
                  <LogOut size={16} />
                </button>
              </div>
            )}
          </header>

          <div ref={viewportRef} className="flex-1 overflow-y-auto px-6 scroll-smooth">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col justify-center items-center text-center max-w-2xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <h2 className="text-5xl font-medium leading-tight">
                    Welcome to <span className="animate-shine font-bold">CynthAI</span>
                  </h2>
                  <p className="text-gray-500 text-lg">Powered by Kinetica Prime Industries</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-12">
                    {[
                      "Generate a Python script for data analysis",
                      "Create an image of a futuristic city",
                      "Analyze this uploaded image",
                      "Write a React component for a dashboard"
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setChatInput(suggestion)}
                        className="p-4 rounded-2xl bg-[#1e1f20] border border-white/5 hover:border-[#4285f4]/50 transition-all text-sm text-left text-gray-400 hover:text-white"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto w-full flex flex-col gap-8 py-8">
                {messages.map((msg, i) => (
                  <div key={i} className={msg.role === 'user' ? 'self-end max-w-[80%]' : 'flex gap-4 w-full group'}>
                    {msg.role === 'user' ? (
                      <div className="flex flex-col items-end gap-2">
                        {msg.image && (
                          <img src={msg.image} alt="User upload" className="max-w-xs rounded-2xl border border-white/10 shadow-xl" referrerPolicy="no-referrer" />
                        )}
                        <div className="bg-[#2b2c2e] px-6 py-4 rounded-[22px_22px_4px_22px] border border-white/5 shadow-lg">
                          {msg.text}
                        </div>
                      </div>
                    ) : (
                      <>
                        <GeminiIcon isThinking={isThinking || msg.isStreaming || false} />
                        <div className="flex-1 overflow-hidden relative">
                          <div className="flex justify-between items-center mb-1">
                            <p className="text-[10px] text-[#4285f4] font-bold uppercase tracking-widest">CynthAI</p>
                            {!msg.isStreaming && msg.text && (
                              <button 
                                onClick={() => copyToClipboard(msg.text, i)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white"
                                title="Copy to clipboard"
                              >
                                {copiedId === i ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                              </button>
                            )}
                          </div>
                          <div className="text-lg leading-relaxed text-gray-200">
                            {msg.image && (
                              <div className="mb-4 relative group/image">
                                <img src={msg.image} alt="AI generated" className="w-full rounded-2xl border border-white/10 shadow-2xl" referrerPolicy="no-referrer" />
                                <a 
                                  href={msg.image} 
                                  download={`cynthai-gen-${Date.now()}.png`}
                                  className="absolute bottom-4 right-4 p-3 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-xl text-white opacity-0 group-hover/image:opacity-100 transition-all duration-300 flex items-center gap-2 border border-white/10 shadow-xl"
                                  title="Download image"
                                >
                                  <Download size={18} />
                                  <span className="text-xs font-medium">Download</span>
                                </a>
                              </div>
                            )}
                            <div className="markdown-body">
                              <Markdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  code({ node, inline, className, children, ...props }: any) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    return !inline && match ? (
                                      <div className="relative group/code">
                                        <button 
                                          onClick={() => copyToClipboard(String(children), i + 1000)}
                                          className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity p-1.5 bg-black/50 hover:bg-black/80 rounded-lg text-gray-400 hover:text-white z-10"
                                        >
                                          {copiedId === i + 1000 ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                        </button>
                                        <SyntaxHighlighter
                                          style={atomDark}
                                          language={match[1]}
                                          PreTag="div"
                                          className="rounded-xl my-4 border border-white/5"
                                          {...props}
                                        >
                                          {String(children).replace(/\n$/, '')}
                                        </SyntaxHighlighter>
                                      </div>
                                    ) : (
                                      <code className="bg-[#2b2c2e] px-1.5 py-0.5 rounded text-[#4285f4] font-mono text-sm" {...props}>
                                        {children}
                                      </code>
                                    );
                                  }
                                }}
                              >
                                {msg.text}
                              </Markdown>
                            </div>

                            {msg.sources && msg.sources.length > 0 && (
                              <div className="mt-6 pt-4 border-t border-white/5 flex flex-wrap gap-2">
                                {msg.sources.map((source, idx) => (
                                  <a 
                                    key={idx}
                                    href={source.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-3 py-1.5 bg-[#1e1f20] hover:bg-[#2b2c2e] border border-white/5 rounded-full text-[10px] font-medium text-gray-400 hover:text-white transition-all group/source"
                                    title={source.title}
                                  >
                                    <Globe size={12} className="text-[#4285f4]" />
                                    <span className="max-w-[120px] truncate">{source.title}</span>
                                    <ExternalLink size={10} className="opacity-0 group-hover/source:opacity-100 transition-opacity" />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {isThinking && (
                  <div className="flex gap-4 w-full">
                    <GeminiIcon isThinking={true} />
                    <div className="flex-1 space-y-2 pt-2">
                      <div className="h-4 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded w-3/4 animate-pulse"></div>
                      <div className="h-4 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded w-1/2 animate-pulse"></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <form onSubmit={sendMessage} className="p-6 bg-gradient-to-t from-[#0e0e10] via-[#0e0e10] to-transparent">
            <div className="max-w-3xl mx-auto flex flex-col gap-3">
              <AnimatePresence>
                {selectedFile && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="flex items-center gap-3 bg-[#1e1f20] p-2 rounded-2xl border border-white/5 w-fit"
                  >
                    <img src={selectedFile.preview} alt="Preview" className="w-12 h-12 rounded-lg object-cover" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold truncate max-w-[150px]">{selectedFile.file.name}</span>
                      <span className="text-[10px] text-gray-500 uppercase">Ready for analysis</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="p-1 hover:bg-white/10 rounded-full transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[#4285f4] to-[#9b72cb] rounded-[35px] opacity-20 group-focus-within:opacity-50 transition duration-500 blur"></div>
                <div className="relative flex items-center bg-[#1e1f20] border border-[#3c4043] rounded-[35px] px-6 py-1">
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-gray-500 hover:text-[#4285f4] p-2 transition-all"
                  >
                    <Paperclip size={20} />
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*,application/pdf,text/*"
                  />
                  <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Initiate query or request generation..." 
                    className="flex-1 bg-transparent border-none outline-none py-4 text-lg text-white placeholder:text-gray-600"
                    autoComplete="off"
                  />
                  <button 
                    type="submit" 
                    disabled={isThinking || (!chatInput.trim() && !selectedFile)}
                    className="text-[#4285f4] hover:scale-110 p-2 transition-all disabled:opacity-30 disabled:hover:scale-100"
                  >
                    <Send size={24} />
                  </button>
                </div>
              </div>
              <p className="text-center text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-2">
                Neural Link Active • Kinetica Prime Industries
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[2000] flex items-center justify-center backdrop-blur-md p-4"
          >
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-[#1e1f20] p-8 md:p-12 rounded-[32px] border border-white/10 w-full max-w-md shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#4285f4] via-[#9b72cb] to-[#d96570]"></div>
              
              <div className="flex justify-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#4285f4] to-[#9b51e0] flex items-center justify-center shadow-xl shadow-blue-500/20">
                  <Zap size={32} className="text-white fill-white" />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-center text-white mb-2">
                {isLogin ? "Welcome back" : "Create your account"}
              </h2>
              <p className="text-gray-400 text-center text-sm mb-8">
                {isLogin ? "Sign in to continue to CynthAI" : "Join the Kinetica Prime neural network"}
              </p>
              
              <button 
                onClick={handleGoogleLogin}
                className="w-full py-3.5 bg-white text-black rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-gray-100 transition-all mb-6 shadow-lg active:scale-[0.98]"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              <div className="relative flex items-center gap-4 mb-6">
                <div className="h-px bg-white/10 flex-1"></div>
                <span className="text-[10px] text-gray-600 uppercase font-bold tracking-widest">or</span>
                <div className="h-px bg-white/10 flex-1"></div>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Email Address</label>
                  <input 
                    type="email" 
                    placeholder="name@example.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#0e0e10] p-4 rounded-xl outline-none border border-white/5 focus:border-[#4285f4] transition-all text-white"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Password</label>
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#0e0e10] p-4 rounded-xl outline-none border border-white/5 focus:border-[#4285f4] transition-all text-white"
                    required
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-[#4285f4] text-white rounded-xl font-bold hover:bg-[#3367d6] transition-all shadow-lg shadow-blue-500/10 active:scale-[0.98] mt-2"
                >
                  {isLogin ? "Sign In" : "Create Account"}
                </button>
              </form>

              <div className="mt-8 text-center">
                <button 
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-gray-400 text-sm hover:text-white transition-colors"
                >
                  {isLogin ? "Don't have an account? " : "Already have an account? "}
                  <span className="text-[#4285f4] font-bold">{isLogin ? "Sign up" : "Sign in"}</span>
                </button>
              </div>

              <button 
                onClick={() => setShowAuthModal(false)}
                className="mt-6 text-gray-600 text-[10px] uppercase block w-full hover:text-gray-400 transition-colors tracking-widest font-bold"
              >
                Cancel
              </button>
              <div className="mt-8 flex justify-center gap-4 text-[10px] text-gray-700 font-bold uppercase tracking-widest">
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-[#4285f4] transition-colors">Privacy Policy</a>
                <span className="text-gray-800">•</span>
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-[#4285f4] transition-colors">Terms of Service</a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}



