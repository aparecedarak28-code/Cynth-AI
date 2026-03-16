import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cpu, Zap, Activity, Shield, Globe, Terminal, Code } from 'lucide-react';

/**
 * CynthAI Neural Core Visualization
 * Synthesized by the Cynth-Neural-Clone Brain.
 * 
 * This component represents the internal logic flow and neural matrix
 * of the CynthAI architecture.
 */

interface NeuralNode {
  id: string;
  type: 'logic' | 'memory' | 'synthesis' | 'input' | 'output';
  label: string;
  status: 'active' | 'idle' | 'processing';
  load: number;
}

export const NeuralCore: React.FC = () => {
  const [nodes, setNodes] = useState<NeuralNode[]>([
    { id: 'n1', type: 'input', label: 'Semantic Input', status: 'active', load: 45 },
    { id: 'n2', type: 'logic', label: 'Intent Classifier', status: 'processing', load: 78 },
    { id: 'n3', type: 'memory', label: 'Neural Matrix v4.0', status: 'active', load: 12 },
    { id: 'n4', type: 'synthesis', label: 'Logic Synthesizer', status: 'idle', load: 0 },
    { id: 'n5', type: 'output', label: 'Neural Response', status: 'idle', load: 0 },
  ]);

  const [logs, setLogs] = useState<string[]>([]);
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setUptime(prev => prev + 1);
      
      // Randomly update node loads and statuses
      setNodes(prev => prev.map(node => ({
        ...node,
        load: Math.floor(Math.random() * 100),
        status: Math.random() > 0.7 ? 'processing' : 'active'
      })));

      // Add simulated logs
      const logMessages = [
        "Synchronizing neural weights...",
        "Querying Kinetica Prime Knowledge Base...",
        "Optimizing logic synthesis paths...",
        "Verifying semantic integrity...",
        "Neural Web-Link heartbeat detected.",
        "Dwane Angelo Aparece's vision protocols active."
      ];
      
      if (Math.random() > 0.5) {
        setLogs(prev => [logMessages[Math.floor(Math.random() * logMessages.length)], ...prev].slice(0, 5));
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const formatUptime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-4xl mx-auto p-8 bg-[#121214] rounded-[32px] border border-white/5 shadow-2xl relative overflow-hidden"
    >
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#4285f4]/10 blur-[100px] -z-10" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#9b72cb]/10 blur-[100px] -z-10" />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#4285f4]/20 rounded-xl text-[#4285f4]">
              <Cpu size={24} />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Neural Core <span className="text-[#4285f4]">v4.0</span></h2>
          </div>
          <p className="text-gray-500 text-sm font-medium uppercase tracking-widest">Kinetica Prime Logic Engine</p>
        </div>

        <div className="flex gap-4">
          <div className="px-4 py-2 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center min-w-[100px]">
            <span className="text-[10px] text-gray-500 font-bold uppercase">Uptime</span>
            <span className="text-lg font-mono text-[#4285f4]">{formatUptime(uptime)}</span>
          </div>
          <div className="px-4 py-2 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center min-w-[100px]">
            <span className="text-[10px] text-gray-500 font-bold uppercase">Status</span>
            <span className="text-lg font-bold text-emerald-400 flex items-center gap-2">
              <Activity size={16} />
              Online
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="md:col-span-2 space-y-4">
          <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-4">Neural Node Matrix</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {nodes.map((node) => (
              <motion.div 
                key={node.id}
                layout
                className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-[#4285f4]/30 transition-all group"
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-gray-400 group-hover:text-white transition-colors">{node.label}</span>
                  <div className={`w-2 h-2 rounded-full ${node.status === 'processing' ? 'bg-blue-400 animate-pulse' : 'bg-emerald-400'}`} />
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${node.load}%` }}
                    className="h-full bg-gradient-to-r from-[#4285f4] to-[#9b72cb]"
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[10px] text-gray-600 font-bold uppercase">{node.type}</span>
                  <span className="text-[10px] text-gray-400 font-mono">{node.load}%</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-4">Live Logic Stream</h3>
          <div className="bg-black/40 rounded-2xl border border-white/5 p-4 h-[240px] font-mono text-[11px] overflow-hidden flex flex-col gap-2">
            <AnimatePresence>
              {logs.map((log, i) => (
                <motion.div 
                  key={log + i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-blue-400/80 flex gap-2"
                >
                  <span className="text-gray-700">[{new Date().toLocaleTimeString()}]</span>
                  <span className="truncate">{log}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Shield, label: 'Security', val: 'Active' },
          { icon: Globe, label: 'Web-Link', val: 'Connected' },
          { icon: Terminal, label: 'CLI Core', val: 'Ready' },
          { icon: Code, label: 'Synthesis', val: 'Elite' },
        ].map((item, i) => (
          <div key={i} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3">
            <div className="p-2 bg-white/5 rounded-lg text-gray-400">
              <item.icon size={16} />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-gray-600 font-bold uppercase">{item.label}</span>
              <span className="text-xs font-bold text-gray-300">{item.val}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 pt-6 border-t border-white/5 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-[#4285f4]" />
          <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">CynthAI Brain Synthesis Engine</span>
        </div>
        <div className="text-[10px] text-gray-700 font-bold">
          © 2026 Kinetica Prime Industries
        </div>
      </div>
    </motion.div>
  );
};
