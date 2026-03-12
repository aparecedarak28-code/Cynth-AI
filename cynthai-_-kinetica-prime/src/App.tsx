import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot
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
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Firebase Configuration
const firebaseConfig = { 
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY, 
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, 
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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
  const [user, setUser] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isThinking, setIsThinking] = useState(false);
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
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [mousePos]);

  // Auth State Listener (Firebase)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        setUser({ uid: firebaseUser.uid, email: firebaseUser.email });
        setShowAuthModal(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load History from Firestore
  useEffect(() => {
    if (user?.uid) {
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

  // OAuth Message Listener
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const userData = event.data.user;
        setUser({
          email: userData.email,
          name: userData.name,
          picture: userData.picture
        });
        setShowAuthModal(false);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Scroll to bottom
  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
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
    try {
      const response = await fetch('/api/auth/google/url');
      if (!response.ok) throw new Error('Failed to get auth URL');
      const { url } = await response.json();
      
      window.open(url, 'google_oauth', 'width=600,height=700');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setUser(null);
    setMessages([]);
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
      // Improved regex for image generation detection
      const isImageGenRequest = /(generate|create|draw|make|paint|show me).*(image|picture|photo|illustration|drawing|portrait)/i.test(prompt) || 
                               /image of|picture of|photo of|drawing of/i.test(prompt);

      if (isImageGenRequest) {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: [{ parts: [{ text: prompt }] }],
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
        
        if (user?.uid) {
          await addDoc(collection(db, "users", user.uid, "chats"), {
            prompt: prompt,
            response: "Generated an image.",
            timestamp: serverTimestamp()
          });
        }
      } else {
        const parts: any[] = [{ text: prompt || "Analyze this file" }];
        
        if (fileToUpload) {
          const base64Data = await fileToBase64(fileToUpload.file);
          parts.push({
            inlineData: {
              data: base64Data,
              mimeType: fileToUpload.file.type
            }
          });
        }

        const responseStream = await ai.models.generateContentStream({
          model: "gemini-flash-latest",
          contents: [{ parts }],
          config: {
            systemInstruction: "You are CynthAI, an advanced intelligence powered by Kinetica Prime Industries. You are capable of code generation, file analysis, and creative reasoning. Provide high-quality code blocks when requested."
          }
        });

        setIsThinking(false);
        let fullText = "";
        
        // Add empty AI message to start streaming
        setMessages(prev => [...prev, { role: 'ai', text: "", isStreaming: true }]);

        for await (const chunk of responseStream) {
          const chunkText = chunk.text || "";
          fullText += chunkText;
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMsg = newMessages[newMessages.length - 1];
            if (lastMsg && lastMsg.role === 'ai') {
              lastMsg.text = fullText;
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
                    onChange={(e: { target: { value: any; }; }) => setChatInput(e.target.value)}
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
            className="fixed inset-0 bg-black/95 z-2000 flex items-center justify-center backdrop-blur-md p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#1e1f20] p-10 rounded-[40px] border border-white/10 w-full max-w-sm text-center shadow-2xl"
            >
              <h2 className="text-3xl font-bold mb-6 animate-shine">
                {isLogin ? "Access" : "Join Hub"}
              </h2>
              
              <button 
                onClick={handleGoogleLogin}
                className="w-full py-4 bg-white text-black rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-gray-200 transition-all mb-4"
              >
                <Chrome size={20} />
                Continue with Google
              </button>

              <div className="flex items-center gap-4 my-6">
                <div className="h-px bg-white/10 flex-1"></div>
                <span className="text-xs text-gray-600 uppercase font-bold">or</span>
                <div className="h-px bg-white/10 flex-1"></div>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                <input 
                  type="email" 
                  placeholder="Email" 
                  value={email}
                  onChange={(e: { target: { value: any; }; }) => setEmail(e.target.value)}
                  className="w-full bg-[#0e0e10] p-4 rounded-2xl outline-none border border-white/5 focus:border-[#4285f4] transition-all"
                  required
                />
                <input 
                  type="password" 
                  placeholder="Password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0e0e10] p-4 rounded-2xl outline-none border border-white/5 focus:border-[#4285f4] transition-all"
                  required
                />
                <button 
                  type="submit"
                  className="w-full py-4 bg-[#4285f4] rounded-2xl font-bold hover:bg-[#3367d6] transition-all"
                >
                  {isLogin ? "Sign In" : "Sign Up"}
                </button>
              </form>
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="mt-6 text-[#4285f4] text-sm hover:underline"
              >
                {isLogin ? "Create an account" : "Back to Sign In"}
              </button>
              <button 
                onClick={() => setShowAuthModal(false)}
                className="mt-4 text-gray-600 text-[10px] uppercase block w-full hover:text-gray-400 transition-colors"
              >
                Close
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



