'use client';
import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/* ── MODULE PALETTE ────────────────────────────────────── */
const PALETTE_GROUPS = [
  {
    label: 'Entrada',
    items: [
      { type: 'keywords', label: 'Keywords', icon: '🔑', color: '#ff5a1f', desc: 'Palabras clave a monitorear' },
    ],
  },
  {
    label: 'Canales',
    items: [
      { type: 'x', label: 'X/Twitter', icon: '𝕏', color: '#1DA1F2', desc: 'Perfiles y tweets' },
      { type: 'reddit', label: 'Reddit', icon: '🟠', color: '#FF4500', desc: 'Posts y comentarios' },
      { type: 'news', label: 'Noticias', icon: '📰', color: '#2D3748', desc: 'Google News + API' },
      { type: 'youtube', label: 'YouTube', icon: '▶️', color: '#FF0000', desc: 'Videos por keyword' },
      { type: 'bluesky', label: 'Bluesky', icon: '🦋', color: '#0085FF', desc: 'Posts públicos' },
      { type: 'mastodon', label: 'Mastodon', icon: '🐘', color: '#6364FF', desc: 'Fediverso' },
      { type: 'hacker_news', label: 'Hacker News', icon: '🟧', color: '#FF6600', desc: 'Keyword search' },
      { type: 'tiktok', label: 'TikTok', icon: '🎵', color: '#000000', desc: 'Videos trending' },
      { type: 'google_alert', label: 'Google Alerts', icon: '🔔', color: '#4285F4', desc: 'RSS feeds' },
      { type: 'google_trends', label: 'Trends', icon: '📈', color: '#4285F4', desc: 'Interés temporal' },
      { type: 'google_serp', label: 'SERP', icon: '🔍', color: '#34A853', desc: 'Rankings Google' },
      { type: 'google_ads', label: 'Google Ads', icon: '🎯', color: '#FBBC04', desc: 'Anuncios' },
      { type: 'meta_ads', label: 'Meta Ads', icon: '📱', color: '#1877F2', desc: 'FB + IG ads' },
      { type: 'site_monitor', label: 'Sitios Web', icon: '🌐', color: '#6B7280', desc: 'Cambios visuales' },
    ],
  },
  {
    label: 'Inteligencia',
    items: [
      { type: 'ai-analysis', label: 'AI Analysis', icon: '🤖', color: '#8b63e7', desc: 'Clasifica, resume, sentimiento' },
    ],
  },
  {
    label: 'Alertas',
    items: [
      { type: 'google-chat', label: 'Google Chat', icon: '📢', color: '#34A853', desc: 'Notificar a Chat' },
      { type: 'email-alert', label: 'Email Alert', icon: '📧', color: '#F59E0B', desc: 'Notificar por email' },
    ],
  },
];

/* ── CUSTOM NODE COMPONENT ─────────────────────────────── */
function PipelineNode({ data }) {
  const { label, icon, color, desc, active, type } = data;
  const isInput = type === 'keywords';
  const isOutput = type === 'alert-engine';

  if (isInput) {
    return (
      <div className="px-5 py-3 rounded-[16px] shadow-lg" style={{
        background: 'linear-gradient(135deg, #ff5a1f, #ff7c2b)', color: '#fff',
        border: 'none', minWidth: 180,
      }}>
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] opacity-70 mb-1">Input</div>
        <div className="text-[14px] font-bold">{icon} {label}</div>
        {data.keywords && <div className="text-[11px] mt-1 opacity-80">{data.keywords}</div>}
      </div>
    );
  }

  if (isOutput) {
    return (
      <div className="px-5 py-3 rounded-[16px] shadow-lg" style={{
        background: 'linear-gradient(135deg, #2b8e5c, #3bae7c)', color: '#fff',
        border: 'none', minWidth: 200,
      }}>
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] opacity-70 mb-1">Salida</div>
        <div className="text-[14px] font-bold">{icon} {label}</div>
        <div className="flex gap-2 mt-1.5">
          {data.chat && <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-[6px]">📢 Chat</span>}
          {data.email && <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-[6px]">📧 Email</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-2.5 rounded-[14px] border-2 transition-all duration-200 cursor-grab select-none min-w-[150px] shadow-sm hover:shadow-md"
      style={{
        background: active !== false ? `${color}15` : '#f5f5f5',
        borderColor: active !== false ? color : '#e0e0e0',
      }}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-lg">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-bold" style={{ color: active !== false ? color : '#bbb' }}>
            {label}
          </div>
          {desc && <div className="text-[9px] text-[#988d84] truncate">{desc}</div>}
        </div>
        {active !== false && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />}
      </div>
    </div>
  );
}

const nodeTypes = { pipelineNode: PipelineNode };

/* ── MAIN FLOW BUILDER ─────────────────────────────────── */
export default function FlowBuilder({ job, onRun, onSave, onBack }) {
  const [jobName, setJobName] = useState(job?.name || '');
  const [keywordsStr, setKeywordsStr] = useState(
    ((typeof job?.keywords === 'string' ? JSON.parse(job.keywords) : job?.keywords) || []).join(', ')
  );
  const activeChannels = (typeof job?.channels === 'string' ? JSON.parse(job.channels) : job?.channels) || [];
  const [schedule, setSchedule] = useState(job?.schedule_minutes || 60);
  const [notifyChat, setNotifyChat] = useState(job?.notify_google_chat ?? true);
  const [notifyEmail, setNotifyEmail] = useState(job?.notify_email ?? false);
  const [rssUrls, setRssUrls] = useState(
    ((typeof job?.google_alerts_rss_urls === 'string' ? JSON.parse(job.google_alerts_rss_urls) : job?.google_alerts_rss_urls) || []).join(', ')
  );
  const [flowRunning, setFlowRunning] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  // Build nodes from job data
  const initialNodes = useMemo(() => [
    {
      id: 'keywords-in',
      type: 'pipelineNode',
      position: { x: 550, y: 20 },
      data: {
        type: 'keywords', label: 'Keywords', icon: '🔑', color: '#ff5a1f',
        keywords: keywordsStr || 'visa, inmigración',
        active: true,
      },
    },
    ...activeChannels.map((id, i) => {
      const ch = PALETTE_GROUPS.flatMap(g => g.items).find(item => item.type === id);
      if (!ch) return null;
      const cols = Math.min(4, Math.max(2, Math.ceil(activeChannels.length / 3)));
      return {
        id,
        type: 'pipelineNode',
        position: { x: (i % cols) * 210 + 60, y: Math.floor(i / cols) * 110 + 150 },
        data: { ...ch, active: true },
      };
    }).filter(Boolean),
    {
      id: 'alert-engine',
      type: 'pipelineNode',
      position: { x: 550, y: 600 },
      data: {
        type: 'alert-engine', label: 'Alert Engine', icon: '🔔',
        color: '#2b8e5c', active: true, chat: notifyChat, email: notifyEmail,
      },
    },
  ], [keywordsStr, activeChannels, notifyChat, notifyEmail]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Build edges
  useEffect(() => {
    const channelIds = activeChannels;
    const newEdges = [
      ...channelIds.map(id => ({
        id: `kw-${id}`, source: 'keywords-in', target: id,
        animated: true,
        style: { stroke: '#ff5a1f', strokeWidth: 2.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#ff5a1f', width: 20, height: 20 },
      })),
      ...channelIds.map(id => ({
        id: `${id}-out`, source: id, target: 'alert-engine',
        style: { stroke: '#2b8e5c', strokeWidth: 2, strokeDasharray: '6 3' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#2b8e5c', width: 20, height: 20 },
      })),
    ];
    // Add AI node edge if present
    if (nodes.find(n => n.id === 'ai-analysis')) {
      newEdges.push({
        id: 'ai-edge', source: 'keywords-in', target: 'ai-analysis',
        animated: true, style: { stroke: '#8b63e7', strokeWidth: 2, strokeDasharray: '4 4' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#8b63e7' },
      });
    }
    setEdges(newEdges);
  }, [activeChannels, nodes, setEdges]);

  // Update nodes when deps change
  useEffect(() => { setNodes(initialNodes); }, [initialNodes, setNodes]);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    if (!type || !reactFlowInstance) return;
    const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const item = PALETTE_GROUPS.flatMap(g => g.items).find(i => i.type === type);
    if (!item) return;
    const newNode = {
      id: `${type}-${Date.now()}`,
      type: 'pipelineNode',
      position,
      data: { ...item, active: true },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [reactFlowInstance, setNodes]);

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node.id);
  }, []);

  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  const runFlow = async () => {
    setFlowRunning(true);
    const flowNodes = nodes.filter(n => n.id !== 'keywords-in' && n.id !== 'alert-engine');
    for (const node of flowNodes) {
      setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, running: true } } : n));
      await new Promise(r => setTimeout(r, 250));
      setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, running: false, done: true } } : n));
      await new Promise(r => setTimeout(r, 250));
    }
    if (onRun) await onRun();
    setFlowRunning(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const channelNodes = nodes.filter(n =>
      PALETTE_GROUPS[1].items.some(i => i.type === n.id) && n.data?.active !== false
    );
    try {
      if (onSave) await onSave({
        name: jobName,
        keywords: keywordsStr.split(',').map(k => k.trim()).filter(Boolean),
        channels: channelNodes.map(n => n.id.replace(/-\d+$/, '')),
        schedule_minutes: schedule,
        notify_google_chat: notifyChat,
        notify_email: notifyEmail,
        google_alerts_rss_urls: rssUrls.split(',').map(u => u.trim()).filter(Boolean),
      });
    } catch (e) { alert('Error: ' + e.message); }
    setSaving(false);
  };

  const askAI = async () => {
    if (!aiInput.trim()) return;
    setAiMessages(prev => [...prev, { role: 'user', text: aiInput }]);
    setAiInput('');
    try {
      const res = await fetch(`${API}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Contexto: Estoy configurando un monitor de inteligencia llamado "${jobName}" con keywords: ${keywordsStr}. Pregunta: ${aiInput}`,
          model: 'llama-3.3-70b',
        }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }
      setAiMessages(prev => [...prev, { role: 'assistant', text }]);
    } catch (e) {
      setAiMessages(prev => [...prev, { role: 'assistant', text: 'Error al consultar AI' }]);
    }
  };

  return (
    <div className="flex h-[calc(100vh-100px)] gap-0 rounded-[20px] overflow-hidden border border-[rgba(32,24,19,0.08)] bg-white dark:bg-[#1a1512]">
      {/* ── MODULE PALETTE ── */}
      <div className="w-[240px] flex-shrink-0 bg-[#faf8f6] dark:bg-[#12100e] border-r border-[rgba(32,24,19,0.08)] flex flex-col overflow-y-auto">
        <div className="px-4 py-3.5 border-b border-[rgba(32,24,19,0.06)]">
          <div className="flex items-center justify-between mb-3">
            <button onClick={onBack} className="text-[#988d84] hover:text-[#201813] text-sm">← Volver</button>
            <h2 className="font-syne text-[14px] text-[#201813] dark:text-[var(--ink)]">Módulos</h2>
          </div>
          <input
            value={jobName}
            onChange={e => setJobName(e.target.value)}
            className="w-full px-3 py-2 rounded-[10px] border border-[rgba(32,24,19,0.12)] text-[12px] font-bold text-[#201813] dark:bg-[#0f0b09] dark:text-[var(--ink)] outline-none focus:border-[#ff5a1f] bg-white"
            placeholder="Nombre del monitor"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {PALETTE_GROUPS.map(group => (
            <div key={group.label}>
              <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#988d84] px-2 mb-2">{group.label}</div>
              <div className="space-y-1">
                {group.items.map(item => (
                  <div
                    key={item.type}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/reactflow', item.type);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] cursor-grab hover:bg-white dark:hover:bg-[#0f0b09] hover:shadow-sm transition-all active:cursor-grabbing border border-transparent hover:border-[rgba(32,24,19,0.08)]"
                  >
                    <span className="text-base flex-shrink-0">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold" style={{ color: item.color }}>{item.label}</div>
                      <div className="text-[9px] text-[#988d84] truncate">{item.desc}</div>
                    </div>
                    <span className="text-[10px] text-[#ccc]">⋮⋮</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom: schedule + save */}
        <div className="px-4 py-3 border-t border-[rgba(32,24,19,0.06)] space-y-2">
          <select value={schedule} onChange={e => setSchedule(Number(e.target.value))}
            className="w-full px-3 py-1.5 rounded-[8px] border border-[rgba(32,24,19,0.12)] text-[11px] text-[#201813] dark:bg-[#0f0b09] dark:text-[var(--ink)] outline-none bg-white">
            <option value={30}>30 min</option>
            <option value={60}>1 hora</option>
            <option value={120}>2 horas</option>
            <option value={360}>6 horas</option>
            <option value={1440}>1 día</option>
          </select>
          <button onClick={handleSave} disabled={saving}
            className="w-full py-2 rounded-[10px] bg-gradient-to-r from-[#ff5a1f] to-[#ff7c2b] text-white text-[12px] font-bold hover:shadow-lg transition-all disabled:opacity-50">
            {saving ? 'Guardando...' : '💾 Guardar'}
          </button>
        </div>
      </div>

      {/* ── CANVAS ── */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-white dark:bg-[#1a1512] border-b border-[rgba(32,24,19,0.06)]">
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[#5f564f]">
              <strong className="text-[#201813] dark:text-[var(--ink)]">{activeChannels.length}</strong> canales
            </span>
            <span className="w-px h-3 bg-[rgba(32,24,19,0.1)]" />
            <span className="text-[11px] text-[#988d84]">
              Keywords: <strong className="text-[#5f564f]">{keywordsStr || '—'}</strong>
            </span>
            <span className="w-px h-3 bg-[rgba(32,24,19,0.1)]" />
            <span className="text-[11px] text-[#988d84]">
              {nodes.length} nodos · {edges.length} conexiones
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAI(!showAI)}
              className="px-3 py-1.5 rounded-[8px] text-xs font-bold bg-[#8b63e7] text-white hover:bg-[#7a53d6] transition-all flex items-center gap-1.5">
              🤖 AI Assistant
            </button>
            <button onClick={() => { setNodes(initialNodes); }}
              className="px-3 py-1.5 rounded-[8px] text-xs text-[#5f564f] hover:bg-[rgba(32,24,19,0.06)] transition-all">
              🔄 Reset
            </button>
            <button onClick={runFlow} disabled={flowRunning}
              className="px-4 py-1.5 rounded-[8px] text-xs font-bold bg-[#ff5a1f] text-white hover:bg-[#e04a10] transition-all disabled:opacity-50 flex items-center gap-1.5">
              {flowRunning ? <><span className="w-2 h-2 rounded-full bg-white animate-pulse-slow" /> Ejecutando</> : '▶ Ejecutar'}
            </button>
          </div>
        </div>

        {/* Canvas area */}
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onInit={setReactFlowInstance}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.2}
              maxZoom={2.5}
              snapToGrid
              snapGrid={[20, 20]}
              attributionPosition="bottom-left"
              defaultEdgeOptions={{
                style: { strokeWidth: 2, stroke: '#988d84' },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#988d84' },
              }}
            >
              <Controls className="!rounded-[10px] !shadow-sm" />
              <MiniMap
                style={{ borderRadius: '12px', border: '1px solid rgba(32,24,19,0.08)' }}
                nodeColor={(n) => n.data?.color || '#666'}
                maskColor="rgba(0,0,0,0.04)"
              />
              <Background
                variant="dots"
                gap={24}
                size={1.5}
                color="rgba(32,24,19,0.08)"
              />
            </ReactFlow>
          </ReactFlowProvider>

          {/* Node Config Tooltip */}
          {selectedNode && (
            <div className="absolute top-4 right-4 z-10 bg-white dark:bg-[#1a1512] rounded-[14px] shadow-lg border border-[rgba(32,24,19,0.1)] p-4 w-[260px]">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[12px] font-bold text-[#201813] dark:text-[var(--ink)]">
                  {nodes.find(n => n.id === selectedNode)?.data?.icon}{' '}
                  {nodes.find(n => n.id === selectedNode)?.data?.label}
                </span>
                <button onClick={() => setSelectedNode(null)} className="text-[#988d84] hover:text-[#201813]">✕</button>
              </div>
              {selectedNode === 'keywords-in' ? (
                <input value={keywordsStr} onChange={e => setKeywordsStr(e.target.value)}
                  className="w-full px-3 py-2 rounded-[8px] border border-[rgba(32,24,19,0.12)] text-[12px] outline-none focus:border-[#ff5a1f]" placeholder="Keywords" />
              ) : (
                <div className="text-[11px] text-[#5f564f] space-y-2">
                  <p>Arrastra módulos desde la paleta izquierda al canvas.</p>
                  <p>Conecta los nodos arrastrando desde el borde de un nodo a otro.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── AI ASSISTANT PANEL ── */}
      {showAI && (
        <div className="w-[320px] flex-shrink-0 bg-white dark:bg-[#1a1512] border-l border-[rgba(32,24,19,0.08)] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(32,24,19,0.06)]">
            <h3 className="text-[13px] font-bold text-[#201813] dark:text-[var(--ink)]">🤖 AI Assistant</h3>
            <button onClick={() => setShowAI(false)} className="text-[#988d84] hover:text-[#201813]">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-[12px]">
            {aiMessages.length === 0 && (
              <div className="text-center py-8 text-[#988d84]">
                <p className="mb-2">Pregúntale a la AI sobre tu pipeline:</p>
                <div className="space-y-1.5">
                  {['Sugiere canales para monitorear "visa"', '¿Qué canales recomiendas para tech?', 'Configura alertas para keywords críticas'].map((q, i) => (
                    <button key={i} onClick={() => { setAiInput(q); }}
                      className="block w-full text-left px-3 py-2 rounded-[8px] bg-[rgba(32,24,19,0.04)] hover:bg-[rgba(255,90,31,0.08)] text-[#5f564f] transition-all">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {aiMessages.map((msg, i) => (
              <div key={i} className={`p-3 rounded-[10px] ${msg.role === 'user' ? 'bg-[rgba(255,90,31,0.08)] ml-4' : 'bg-[rgba(32,24,19,0.04)] mr-4'}`}>
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#988d84] mb-1">
                  {msg.role === 'user' ? 'Tú' : 'AI'}
                </div>
                <div className="text-[#201813] dark:text-[var(--ink)]">{msg.text}</div>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-[rgba(32,24,19,0.06)] flex gap-2">
            <input value={aiInput} onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && askAI()}
              className="flex-1 px-3 py-2 rounded-[10px] border border-[rgba(32,24,19,0.12)] text-[12px] outline-none focus:border-[#8b63e7] dark:bg-[#0f0b09] dark:text-[var(--ink)]"
              placeholder="Pregunta a la AI..." />
            <button onClick={askAI} className="px-3 py-2 rounded-[10px] bg-[#8b63e7] text-white text-xs font-bold hover:bg-[#7a53d6]">Enviar</button>
          </div>
        </div>
      )}
    </div>
  );
}
