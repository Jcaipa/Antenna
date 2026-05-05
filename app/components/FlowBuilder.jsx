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
      { type: 'keywords', label: 'Keywords', icon: '🔑', color: '#ff5a1f', desc: 'Palabras clave' },
    ],
  },
  {
    label: 'Canales',
    items: [
      { type: 'x', label: 'X/Twitter', icon: '𝕏', color: '#1DA1F2', desc: 'Perfiles y tweets' },
      { type: 'reddit', label: 'Reddit', icon: '🟠', color: '#FF4500', desc: 'Posts y comentarios' },
      { type: 'news', label: 'Noticias', icon: '📰', color: '#2D3748', desc: 'Google News' },
      { type: 'youtube', label: 'YouTube', icon: '▶️', color: '#FF0000', desc: 'Videos' },
      { type: 'bluesky', label: 'Bluesky', icon: '🦋', color: '#0085FF', desc: 'Posts públicos' },
      { type: 'mastodon', label: 'Mastodon', icon: '🐘', color: '#6364FF', desc: 'Fediverso' },
      { type: 'hacker_news', label: 'Hacker News', icon: '🟧', color: '#FF6600', desc: 'Discusiones' },
      { type: 'tiktok', label: 'TikTok', icon: '🎵', color: '#000000', desc: 'Videos' },
      { type: 'google_alert', label: 'Google Alerts', icon: '🔔', color: '#4285F4', desc: 'RSS feeds' },
      { type: 'google_trends', label: 'Trends', icon: '📈', color: '#4285F4', desc: 'Tendencias' },
      { type: 'google_serp', label: 'SERP', icon: '🔍', color: '#34A853', desc: 'Rankings' },
      { type: 'google_ads', label: 'Google Ads', icon: '🎯', color: '#FBBC04', desc: 'Anuncios' },
      { type: 'meta_ads', label: 'Meta Ads', icon: '📱', color: '#1877F2', desc: 'FB + IG' },
      { type: 'site_monitor', label: 'Sitios Web', icon: '🌐', color: '#6B7280', desc: 'Cambios' },
    ],
  },
  {
    label: 'Inteligencia',
    items: [
      { type: 'ai-analysis', label: 'AI Analysis', icon: '🤖', color: '#8b63e7', desc: 'Clasifica y resume' },
    ],
  },
  {
    label: 'Alertas',
    items: [
      { type: 'google-chat', label: 'Google Chat', icon: '📢', color: '#34A853', desc: 'Notificar a Chat' },
      { type: 'email-alert', label: 'Email Alert', icon: '📧', color: '#F59E0B', desc: 'Notificar email' },
    ],
  },
];

const ALL_PALETTE_ITEMS = PALETTE_GROUPS.flatMap(g => g.items);

/* ── CUSTOM NODE ───────────────────────────────────────── */
function PipelineNode({ data }) {
  const { label, icon, color, desc, type, active, keywords, chat, email } = data;
  const isInput = type === 'keywords';
  const isOutput = type === 'alert-engine';

  if (isInput) {
    return (
      <div className="px-5 py-3.5 rounded-[16px] shadow-lg min-w-[200px] select-none"
        style={{ background: 'linear-gradient(135deg, #ff5a1f, #ff7c2b)', color: '#fff' }}>
        <div className="text-[10px] font-bold uppercase tracking-[0.08em] opacity-70 mb-1">INPUT</div>
        <div className="text-[15px] font-bold">🔑 {label}</div>
        {keywords && <div className="text-[11px] mt-1.5 opacity-80 leading-relaxed">{keywords}</div>}
      </div>
    );
  }

  if (isOutput) {
    return (
      <div className="px-5 py-3.5 rounded-[16px] shadow-lg min-w-[220px] select-none"
        style={{ background: 'linear-gradient(135deg, #1a6b3c, #2b8e5c)', color: '#fff' }}>
        <div className="text-[10px] font-bold uppercase tracking-[0.08em] opacity-70 mb-1">OUTPUT</div>
        <div className="text-[15px] font-bold">🔔 {label}</div>
        <div className="flex gap-2 mt-2">
          {chat && <span className="text-[10px] bg-white/20 px-2.5 py-1 rounded-[6px]">📢 Chat</span>}
          {email && <span className="text-[10px] bg-white/20 px-2.5 py-1 rounded-[6px]">📧 Email</span>}
        </div>
      </div>
    );
  }

  const isAlert = type === 'google-chat' || type === 'email-alert';
  const isAI = type === 'ai-analysis';

  return (
    <div className={`px-4 py-2.5 rounded-[14px] border-2 transition-all duration-200 select-none min-w-[160px] shadow-sm hover:shadow-md ${isAI ? 'cursor-crosshair' : 'cursor-grab'}`}
      style={{
        background: isAI ? `${color}15` : (active !== false ? `${color}15` : '#f5f5f5'),
        borderColor: active !== false ? color : '#e0e0e0',
        borderStyle: isAlert ? 'dashed' : 'solid',
      }}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-lg">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-bold" style={{ color: active !== false ? color : '#bbb' }}>{label}</div>
          {desc && <div className="text-[9px] text-[#988d84] truncate">{desc}</div>}
        </div>
        {active !== false && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />}
      </div>
    </div>
  );
}

const nodeTypes = { pipelineNode: PipelineNode };

/* ── FLOW BUILDER ──────────────────────────────────────── */
export default function FlowBuilder({ job, onRun, onSave, onBack }) {
  const [jobName, setJobName] = useState(job?.name || '');
  const [keywordsStr, setKeywordsStr] = useState(
    ((typeof job?.keywords === 'string' ? JSON.parse(job.keywords) : job?.keywords) || []).join(', ')
  );
  const activeChannelTypes = (typeof job?.channels === 'string' ? JSON.parse(job.channels) : job?.channels) || [];
  const [schedule, setSchedule] = useState(job?.schedule_minutes || 60);
  const [notifyChat, setNotifyChat] = useState(job?.notify_google_chat ?? true);
  const [notifyEmail, setNotifyEmail] = useState(job?.notify_email ?? false);
  const [flowRunning, setFlowRunning] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiStreaming, setAiStreaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const nodeIdCounter = useRef(Date.now());

  const getNodeId = (type) => `${type}-${++nodeIdCounter.current}`;

  // ── BUILD INITIAL NODES ──
  const initialNodes = useMemo(() => {
    const keywordsId = 'keywords-in';
    const nodes = [
      {
        id: keywordsId,
        type: 'pipelineNode',
        position: { x: 600, y: 20 },
        data: { type: 'keywords', label: 'Keywords', icon: '🔑', color: '#ff5a1f', keywords: keywordsStr, active: true },
      },
    ];

    activeChannelTypes.forEach((type, i) => {
      const item = ALL_PALETTE_ITEMS.find(p => p.type === type);
      if (!item) return;
      const id = getNodeId(type);
      const cols = 4;
      nodes.push({
        id,
        type: 'pipelineNode',
        position: { x: (i % cols) * 220 + 100, y: Math.floor(i / cols) * 120 + 160 },
        data: { ...item, active: true },
      });
    });

    nodes.push({
      id: 'alert-engine',
      type: 'pipelineNode',
      position: { x: 600, y: 650 },
      data: { type: 'alert-engine', label: 'Alert Engine', icon: '🔔', color: '#2b8e5c', active: true, chat: notifyChat, email: notifyEmail },
    });

    // Add alert nodes if active
    if (notifyChat) {
      const chatId = getNodeId('google-chat');
      nodes.push({
        id: chatId,
        type: 'pipelineNode',
        position: { x: 400, y: 650 },
        data: { type: 'google-chat', label: 'Google Chat', icon: '📢', color: '#34A853', desc: 'Notificar a Chat', active: true },
      });
    }
    if (notifyEmail) {
      const emailId = getNodeId('email-alert');
      nodes.push({
        id: emailId,
        type: 'pipelineNode',
        position: { x: 800, y: 650 },
        data: { type: 'email-alert', label: 'Email Alert', icon: '📧', color: '#F59E0B', desc: 'Notificar email', active: true },
      });
    }

    return nodes;
  }, [keywordsStr, activeChannelTypes, notifyChat, notifyEmail]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // ── BUILD EDGE ──
  const buildEdges = useCallback((currentNodes) => {
    const channelNodeIds = currentNodes
      .filter(n => n.id !== 'keywords-in' && n.id !== 'alert-engine' && !n.id.startsWith('google-chat-') && !n.id.startsWith('email-alert-'))
      .map(n => n.id);

    const alertNodeIds = currentNodes
      .filter(n => n.id.startsWith('google-chat-') || n.id.startsWith('email-alert-'))
      .map(n => n.id);

    const newEdges = [];

    // Keywords → channels
    channelNodeIds.forEach(id => {
      newEdges.push({
        id: `kw-${id}`, source: 'keywords-in', target: id,
        animated: true,
        style: { stroke: '#ff5a1f', strokeWidth: 2.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#ff5a1f', width: 20, height: 20 },
      });
    });

    // Channels → alert engine
    channelNodeIds.forEach(id => {
      newEdges.push({
        id: `${id}-out`, source: id, target: 'alert-engine',
        style: { stroke: '#2b8e5c', strokeWidth: 2, strokeDasharray: '6 3' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#2b8e5c', width: 20, height: 20 },
      });
    });

    // Alert engine → alert nodes
    alertNodeIds.forEach(id => {
      newEdges.push({
        id: `alert-${id}`, source: 'alert-engine', target: id,
        animated: true,
        style: { stroke: '#F59E0B', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#F59E0B', width: 20, height: 20 },
      });
    });

    return newEdges;
  }, []);

  // Update edges when nodes change
  useEffect(() => {
    // Only set edges if they haven't been manually changed
    setEdges(buildEdges(nodes));
  }, [nodes, buildEdges, setEdges]);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  // ── DRAG & DROP ──
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    if (!type || !reactFlowInstance) return;
    const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const item = ALL_PALETTE_ITEMS.find(i => i.type === type);
    if (!item) return;
    const newId = getNodeId(type);
    const newNode = {
      id: newId,
      type: 'pipelineNode',
      position,
      data: { ...item, active: true },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [reactFlowInstance, setNodes]);

  // ── DELETE NODE ──
  const onKeyDown = useCallback((event) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const selected = nodes.find(n => n.selected);
      if (selected && selected.id !== 'keywords-in' && selected.id !== 'alert-engine') {
        setNodes((nds) => nds.filter(n => n.id !== selected.id));
        setEdges((eds) => eds.filter(e => e.source !== selected.id && e.target !== selected.id));
      }
    }
  }, [nodes, setNodes, setEdges]);

  // ── RUN ──
  const runFlow = async () => {
    setFlowRunning(true);
    const flowNodes = nodes.filter(n => n.id !== 'keywords-in' && n.id !== 'alert-engine');
    for (const node of flowNodes) {
      setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, running: true } } : n));
      await new Promise(r => setTimeout(r, 200));
      setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, running: false, done: true } } : n));
      await new Promise(r => setTimeout(r, 200));
    }
    if (onRun) await onRun();
    setFlowRunning(false);
  };

  // ── SAVE ──
  const handleSave = async () => {
    setSaving(true);
    try {
      const channelIds = nodes
        .filter(n => {
          const type = n.data?.type;
          return type && !['keywords', 'alert-engine', 'google-chat', 'email-alert', 'ai-analysis'].includes(type);
        })
        .map(n => n.data?.type);

      if (onSave) await onSave({
        name: jobName,
        keywords: keywordsStr.split(',').map(k => k.trim()).filter(Boolean),
        channels: [...new Set(channelIds)],
        schedule_minutes: schedule,
        notify_google_chat: notifyChat,
        notify_email: notifyEmail,
        google_alerts_rss_urls: [],
      });
    } catch (e) { alert('Error: ' + e.message); }
    setSaving(false);
  };

  // ── AI ──
  const askAI = async () => {
    if (!aiInput.trim() || aiStreaming) return;
    setAiMessages(prev => [...prev, { role: 'user', text: aiInput }]);
    setAiInput('');
    setAiStreaming(true);
    try {
      const res = await fetch(`${API}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Estoy configurando un monitor "${jobName}" con keywords: ${keywordsStr}. ${aiInput}`,
        }),
      });
      if (!res.ok) throw new Error('Error AI');
      const data = await res.json();
      const text = data.response || data.message || data.text || 'Sin respuesta';
      setAiMessages(prev => [...prev, { role: 'assistant', text }]);
    } catch (e) {
      setAiMessages(prev => [...prev, { role: 'assistant', text: 'Error al consultar AI' }]);
    }
    setAiStreaming(false);
  };

  return (
    <div className="flex h-full w-full">
      {/* ── MODULE PALETTE ── */}
      <div className="w-[220px] flex-shrink-0 bg-[#faf8f6] dark:bg-[#12100e] border-r border-[rgba(32,24,19,0.08)] flex flex-col overflow-y-auto">
        <div className="px-4 py-3.5 border-b border-[rgba(32,24,19,0.06)]">
          <div className="flex items-center gap-2 mb-3">
            <button onClick={onBack} className="text-[#988d84] hover:text-[#201813] text-sm flex items-center gap-1">
              ← Volver
            </button>
            <h2 className="font-syne text-[13px] text-[#201813] dark:text-[var(--ink)]">Pipeline</h2>
          </div>
          <input value={jobName} onChange={e => setJobName(e.target.value)}
            className="w-full px-3 py-2 rounded-[10px] border border-[rgba(32,24,19,0.12)] text-[12px] font-bold text-[#201813] dark:bg-[#0f0b09] dark:text-[var(--ink)] outline-none focus:border-[#ff5a1f] bg-white"
            placeholder="Nombre" />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {PALETTE_GROUPS.map(group => (
            <div key={group.label}>
              <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#988d84] px-2 mb-1.5">{group.label}</div>
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <div key={item.type}
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
        <div className="flex items-center justify-between px-5 py-2.5 bg-white dark:bg-[#1a1512] border-b border-[rgba(32,24,19,0.06)]">
          <div className="flex items-center gap-3 text-[11px]">
            <span><strong className="text-[#201813] dark:text-[var(--ink)]">{nodes.length}</strong> nodos</span>
            <span className="w-px h-3 bg-[rgba(32,24,19,0.1)]" />
            <span><strong className="text-[#201813] dark:text-[var(--ink)]">{edges.length}</strong> conexiones</span>
            <span className="w-px h-3 bg-[rgba(32,24,19,0.1)]" />
            <span className="text-[#988d84]">Keywords: <strong className="text-[#5f564f]">{keywordsStr || '—'}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#988d84]">Supr: eliminar nodo</span>
            <button onClick={() => setShowAI(!showAI)}
              className="px-3 py-1.5 rounded-[8px] text-xs font-bold bg-[#8b63e7] text-white hover:bg-[#7a53d6] transition-all flex items-center gap-1.5">
              🤖 {showAI ? 'Cerrar AI' : 'AI Asistente'}
            </button>
            <button onClick={() => { setNodes(initialNodes); }}
              className="px-3 py-1.5 rounded-[8px] text-xs text-[#5f564f] hover:bg-[rgba(32,24,19,0.06)] transition-all">
              🔄 Reset
            </button>
            <button onClick={runFlow} disabled={flowRunning}
              className="px-4 py-1.5 rounded-[8px] text-xs font-bold bg-[#ff5a1f] text-white hover:bg-[#e04a10] transition-all disabled:opacity-50 flex items-center gap-1.5">
              {flowRunning ? <><span className="w-2 h-2 rounded-full bg-white animate-pulse-slow" /> Corriendo</> : '▶ Ejecutar'}
            </button>
          </div>
        </div>

        <div className="flex-1 relative" ref={reactFlowWrapper} tabIndex={0} onKeyDown={onKeyDown}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onInit={setReactFlowInstance}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.15}
              maxZoom={3}
              snapToGrid
              snapGrid={[20, 20]}
              attributionPosition="bottom-left"
              deleteKeyCode={['Delete', 'Backspace']}
              selectionOnDrag
              panOnDrag={[2]}
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
                variant="lines"
                gap={28}
                size={1}
                color="rgba(32,24,19,0.07)"
              />
            </ReactFlow>
          </ReactFlowProvider>

          {/* Floating tips */}
          {nodes.length <= 3 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-white dark:bg-[#1a1512] rounded-[12px] shadow-lg border border-[rgba(32,24,19,0.1)] px-4 py-3 text-center text-[11px] text-[#5f564f] animate-fade-up">
              🖱️ Arrastra módulos desde la paleta izquierda al canvas<br />
              🔗 Conéctalos arrastrando desde los bordes de los nodos
            </div>
          )}
        </div>
      </div>

      {/* ── AI ASSISTANT PANEL ── */}
      {showAI && (
        <div className="w-[300px] flex-shrink-0 bg-white dark:bg-[#1a1512] border-l border-[rgba(32,24,19,0.08)] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(32,24,19,0.06)]">
            <h3 className="text-[13px] font-bold text-[#201813] dark:text-[var(--ink)]">🤖 AI Assistant</h3>
            <button onClick={() => setShowAI(false)} className="text-[#988d84] hover:text-[#201813]">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-[12px]">
            {aiMessages.length === 0 && (
              <div className="text-center py-6 text-[#988d84] space-y-2">
                <p>Pregunta sobre tu pipeline:</p>
                {[
                  '¿Qué canales recomiendas para monitorear "visa"?',
                  'Sugiere una configuracion optima para tech',
                  'Como configuro alertas criticas?',
                ].map((q, i) => (
                  <button key={i} onClick={() => { setAiInput(q); }}
                    className="block w-full text-left px-3 py-2 rounded-[8px] bg-[rgba(32,24,19,0.04)] hover:bg-[rgba(255,90,31,0.08)] text-[#5f564f] transition-all text-[11px]">
                    {q}
                  </button>
                ))}
              </div>
            )}
            {aiMessages.map((msg, i) => (
              <div key={i} className={`p-3 rounded-[10px] ${msg.role === 'user' ? 'bg-[rgba(255,90,31,0.08)] ml-4' : 'bg-[rgba(32,24,19,0.04)] mr-4'}`}>
                <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#988d84] mb-1">
                  {msg.role === 'user' ? 'Tú' : 'AI'}
                </div>
                <div className="text-[#201813] dark:text-[var(--ink)]">{msg.text}</div>
              </div>
            ))}
            {aiStreaming && <div className="text-center text-[#988d84] text-[11px]">Pensando...</div>}
          </div>
          <div className="px-4 py-3 border-t border-[rgba(32,24,19,0.06)] flex gap-2">
            <input value={aiInput} onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && askAI()}
              className="flex-1 px-3 py-2 rounded-[10px] border border-[rgba(32,24,19,0.12)] text-[12px] outline-none focus:border-[#8b63e7] dark:bg-[#0f0b09] dark:text-[var(--ink)]"
              placeholder="Pregunta a la AI..." />
            <button onClick={askAI} disabled={aiStreaming}
              className="px-3 py-2 rounded-[10px] bg-[#8b63e7] text-white text-xs font-bold hover:bg-[#7a53d6] disabled:opacity-50">
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
