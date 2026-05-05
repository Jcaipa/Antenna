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

const TIMEZONES = [
  'America/Bogota', 'America/Mexico_City', 'America/Argentina/Buenos_Aires',
  'America/Santiago', 'America/Lima', 'America/Caracas',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'Europe/Madrid', 'Europe/London', 'Europe/Paris',
  'UTC',
];

const FREQ_LABELS = { 30: '30 min', 60: '1 hora', 120: '2 horas', 360: '6 horas', 720: '12 horas', 1440: '24 horas' };

const PALETTE_GROUPS = [
  {
    label: 'Entrada',
    items: [
      { type: 'keywords', label: 'Keywords', icon: '🔑', color: '#ff5a1f', desc: 'Palabras clave' },
      { type: 'schedule', label: 'Schedule', icon: '⏰', color: '#6364FF', desc: 'Frecuencia y zona horaria' },
    ],
  },
  {
    label: 'Canales',
    items: [
      { type: 'x', label: 'X/Twitter', icon: '𝕏', color: '#1DA1F2', desc: 'Perfiles y tweets', defaults: { limit: 50, sort: 'recent' } },
      { type: 'reddit', label: 'Reddit', icon: '🟠', color: '#FF4500', desc: 'Posts y comentarios', defaults: { limit: 50, sort: 'relevance' } },
      { type: 'news', label: 'Noticias', icon: '📰', color: '#2D3748', desc: 'Google News', defaults: { limit: 25 } },
      { type: 'youtube', label: 'YouTube', icon: '▶️', color: '#FF0000', desc: 'Videos', defaults: { limit: 25 } },
      { type: 'bluesky', label: 'Bluesky', icon: '🦋', color: '#0085FF', desc: 'Posts públicos', defaults: { limit: 25 } },
      { type: 'mastodon', label: 'Mastodon', icon: '🐘', color: '#6364FF', desc: 'Fediverso', defaults: { limit: 25 } },
      { type: 'hacker_news', label: 'Hacker News', icon: '🟧', color: '#FF6600', desc: 'Discusiones', defaults: { limit: 50, sort: 'popularity' } },
      { type: 'tiktok', label: 'TikTok', icon: '🎵', color: '#000000', desc: 'Videos', defaults: { limit: 25 } },
      { type: 'google_alert', label: 'Google Alerts', icon: '🔔', color: '#4285F4', desc: 'RSS feeds', defaults: { limit: 50 } },
      { type: 'google_trends', label: 'Trends', icon: '📈', color: '#4285F4', desc: 'Tendencias', defaults: { limit: 10 } },
      { type: 'google_serp', label: 'SERP', icon: '🔍', color: '#34A853', desc: 'Rankings', defaults: { limit: 10 } },
      { type: 'google_ads', label: 'Google Ads', icon: '🎯', color: '#FBBC04', desc: 'Anuncios', defaults: { limit: 10 } },
      { type: 'meta_ads', label: 'Meta Ads', icon: '📱', color: '#1877F2', desc: 'FB + IG', defaults: { limit: 10 } },
      { type: 'site_monitor', label: 'Sitios Web', icon: '🌐', color: '#6B7280', desc: 'Cambios visuales', defaults: { limit: 1 } },
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

/* ── CUSTOM NODE ─────────────────────────────────────────── */
function PipelineNode({ data }) {
  const { label, icon, color, desc, type, active, keywords, chat, email, state, config, schedule, timezone } = data;
  const isInput = type === 'keywords';
  const isOutput = type === 'alert-engine';
  const isSchedule = type === 'schedule';

  const nodeState = state || 'idle';
  const isRunning = nodeState === 'running';
  const isDone = nodeState === 'done';
  const isError = nodeState === 'error';

  const containerStyle = {
    px: isInput ? 5 : 4,
    py: isInput ? 3.5 : 2.5,
    rounded: '16px',
    shadow: 'shadow-lg',
    border: isDone ? '2px solid #10b981' : isError ? '2px solid #ef4444' : '2px solid transparent',
  };

  if (isInput) {
    return (
      <div className={`px-5 py-3.5 rounded-[16px] shadow-lg min-w-[200px] select-none transition-all duration-300 ${isRunning ? 'animate-pulse' : ''}`}
        style={{
          background: 'linear-gradient(135deg, #ff5a1f, #ff7c2b)', color: '#fff',
          boxShadow: isRunning ? '0 0 30px rgba(255,90,31,0.5)' : isDone ? '0 0 20px rgba(16,185,129,0.4)' : undefined,
        }}>
        <div className="text-[10px] font-bold uppercase tracking-[0.08em] opacity-70 mb-1">INPUT</div>
        <div className="text-[15px] font-bold">🔑 {label}</div>
        {keywords && <div className="text-[11px] mt-1.5 opacity-80 leading-relaxed">{keywords}</div>}
        {isDone && <div className="text-[10px] mt-1 text-green-300 font-bold">✓ Listo</div>}
      </div>
    );
  }

  if (isSchedule) {
    return (
      <div className="px-4 py-3 rounded-[16px] shadow-lg min-w-[200px] select-none border-2 transition-all duration-300"
        style={{
          background: isRunning ? 'linear-gradient(135deg, #6364FF, #8586FF)' : 'linear-gradient(135deg, #4a4bcc, #6364FF)',
          color: '#fff', borderColor: isDone ? '#10b981' : 'transparent',
          boxShadow: isRunning ? '0 0 30px rgba(99,100,255,0.5)' : undefined,
        }}>
        <div className="text-[10px] font-bold uppercase tracking-[0.08em] opacity-70 mb-1">TRIGGER</div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">⏰</span>
          <span className="text-[14px] font-bold">{schedule ? `Cada ${FREQ_LABELS[schedule] || schedule + 'min'}` : 'Schedule'}</span>
        </div>
        {timezone && <div className="text-[10px] opacity-60">{timezone}</div>}
        {isDone && <div className="text-[10px] mt-1 text-green-300 font-bold">✓ Programado</div>}
      </div>
    );
  }

  if (isOutput) {
    return (
      <div className={`px-5 py-3.5 rounded-[16px] shadow-lg min-w-[220px] select-none transition-all duration-300 ${isRunning ? 'animate-pulse' : ''}`}
        style={{
          background: 'linear-gradient(135deg, #1a6b3c, #2b8e5c)', color: '#fff',
          boxShadow: isRunning ? '0 0 30px rgba(43,142,92,0.5)' : undefined,
        }}>
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
    <div
      className={`px-4 py-2.5 rounded-[14px] select-none min-w-[160px] shadow-sm hover:shadow-md transition-all duration-300 ${isRunning ? 'animate-pulse' : ''} ${isDone ? 'shadow-[0_0_15px_rgba(16,185,129,0.3)]' : ''}`}
      style={{
        background: isRunning ? `${color}25` : isDone ? '#f0fdf4' : (active !== false ? `${color}12` : '#f5f5f5'),
        border: isDone ? '2px solid #10b981' : isRunning ? `2px solid ${color}` : `2px solid ${active !== false ? color : '#e0e0e0'}`,
        borderStyle: isAlert ? 'dashed' : 'solid',
        cursor: isRunning ? 'wait' : 'pointer',
      }}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-lg">{isRunning ? '⏳' : isDone ? '✅' : icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-bold" style={{ color: isDone ? '#10b981' : active !== false ? color : '#bbb' }}>{label}</div>
          {desc && <div className="text-[9px] text-[#988d84] truncate">{desc}</div>}
        </div>
        {config?.limit && (
          <span className="text-[9px] text-[#988d84] bg-white/80 rounded-[4px] px-1.5 py-0.5">{config.limit} res.</span>
        )}
        {isDone && <span className="w-2 h-2 rounded-full bg-[#10b981]" />}
      </div>
      {config?.sort && <div className="text-[8px] text-[#988d84] mt-1 pl-7">Orden: {config.sort}</div>}
    </div>
  );
}

const nodeTypes = { pipelineNode: PipelineNode };

/* ── CHANNEL CONFIG FIELDS ──────────────────────────────── */
function ChannelConfig({ type, config, onChange, onClose }) {
  const item = ALL_PALETTE_ITEMS.find(p => p.type === type);
  if (!item || !item.defaults) return null;
  const c = config || {};
  return (
    <div className="bg-white dark:bg-[#1a1512] rounded-[14px] shadow-lg border border-[rgba(32,24,19,0.1)] p-4 w-[260px]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-bold flex items-center gap-2">
          <span>{item.icon}</span> {item.label}
        </span>
        <button onClick={onClose} className="text-[#988d84] hover:text-[#201813]">✕</button>
      </div>

      <label className="block mb-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#988d84] block mb-1">Resultados</span>
        <div className="flex items-center gap-2">
          <input type="range" min="5" max="200" value={c.limit || item.defaults.limit || 50}
            onChange={e => onChange({ ...c, limit: parseInt(e.target.value) })}
            className="flex-1 accent-[#ff5a1f]" />
          <span className="text-[12px] font-bold text-[#201813] dark:text-[var(--ink)] min-w-[30px] text-right">{c.limit || item.defaults.limit || 50}</span>
        </div>
      </label>

      {item.defaults.sort && (
        <label className="block mb-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#988d84] block mb-1">Orden</span>
          <select value={c.sort || item.defaults.sort} onChange={e => onChange({ ...c, sort: e.target.value })}
            className="w-full px-3 py-1.5 rounded-[8px] border border-[rgba(32,24,19,0.12)] text-[12px] text-[#201813] dark:bg-[#0f0b09] dark:text-[var(--ink)] outline-none bg-white">
            <option value="relevance">Relevancia</option>
            <option value="recent">Más reciente</option>
            <option value="top">Top / Popular</option>
            <option value="comments">Más comentado</option>
          </select>
        </label>
      )}

      <label className="block mb-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#988d84] block mb-1">Idioma</span>
        <select value={c.language || 'auto'} onChange={e => onChange({ ...c, language: e.target.value })}
          className="w-full px-3 py-1.5 rounded-[8px] border border-[rgba(32,24,19,0.12)] text-[12px] text-[#201813] dark:bg-[#0f0b09] dark:text-[var(--ink)] outline-none bg-white">
          <option value="auto">Auto</option>
          <option value="es">Español</option>
          <option value="en">English</option>
          <option value="pt">Português</option>
          <option value="fr">Français</option>
        </select>
      </label>
    </div>
  );
}

/* ── SCHEDULE CONFIG ─────────────────────────────────────── */
function ScheduleConfig({ schedule, timezone, onChange, onClose }) {
  return (
    <div className="bg-white dark:bg-[#1a1512] rounded-[14px] shadow-lg border border-[rgba(32,24,19,0.1)] p-4 w-[260px]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-bold flex items-center gap-2">⏰ Schedule</span>
        <button onClick={onClose} className="text-[#988d84] hover:text-[#201813]">✕</button>
      </div>

      <label className="block mb-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#988d84] block mb-1">Frecuencia</span>
        <select value={schedule || 60} onChange={e => onChange({ ...{ schedule, timezone }, schedule: parseInt(e.target.value) })}
          className="w-full px-3 py-2 rounded-[8px] border border-[rgba(32,24,19,0.12)] text-[12px] text-[#201813] dark:bg-[#0f0b09] dark:text-[var(--ink)] outline-none bg-white">
          {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>

      <label className="block mb-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#988d84] block mb-1">Zona Horaria</span>
        <select value={timezone || 'America/Bogota'} onChange={e => onChange({ ...{ schedule, timezone }, timezone: e.target.value })}
          className="w-full px-3 py-2 rounded-[8px] border border-[rgba(32,24,19,0.12)] text-[12px] text-[#201813] dark:bg-[#0f0b09] dark:text-[var(--ink)] outline-none bg-white">
          {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>)}
        </select>
      </label>

      {schedule && (
        <div className="text-[10px] text-[#988d84] bg-[rgba(32,24,19,0.04)] rounded-[8px] p-2">
          Próxima ejecución aprox. cada {FREQ_LABELS[schedule] || schedule + ' min'}
        </div>
      )}
    </div>
  );
}

/* ── FLOW BUILDER ─────────────────────────────────────────── */
export default function FlowBuilder({ job, onRun, onSave, onBack }) {
  const [jobName, setJobName] = useState(job?.name || '');
  const [keywordsStr, setKeywordsStr] = useState(
    ((typeof job?.keywords === 'string' ? JSON.parse(job.keywords) : job?.keywords) || []).join(', ')
  );
  const activeChannelTypes = (typeof job?.channels === 'string' ? JSON.parse(job.channels) : job?.channels) || [];
  const [schedule, setSchedule] = useState(job?.schedule_minutes || 60);
  const [timezone, setTimezone] = useState('America/Bogota');
  const [notifyChat, setNotifyChat] = useState(job?.notify_google_chat ?? true);
  const [notifyEmail, setNotifyEmail] = useState(job?.notify_email ?? false);
  const [flowRunning, setFlowRunning] = useState(false);
  const [runProgress, setRunProgress] = useState('');
  const [showAI, setShowAI] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiStreaming, setAiStreaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [configNode, setConfigNode] = useState(null);
  const [nodeConfigs, setNodeConfigs] = useState({});
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const nodeIdCounter = useRef(job ? Date.now() : Date.now());

  const getNodeId = (type) => `${type}-${++nodeIdCounter.current}`;

  /* ── BUILD NODES ── */
  const initialNodes = useMemo(() => {
    const nodes = [
      {
        id: 'keywords-in',
        type: 'pipelineNode', position: { x: 600, y: 10 },
        data: { type: 'keywords', label: 'Keywords', icon: '🔑', color: '#ff5a1f', keywords: keywordsStr, active: true, state: 'idle' },
      },
      {
        id: 'schedule-node',
        type: 'pipelineNode', position: { x: 600, y: 120 },
        data: { type: 'schedule', label: 'Schedule', icon: '⏰', color: '#6364FF', schedule, timezone, active: true, state: 'idle' },
      },
    ];

    activeChannelTypes.forEach((type, i) => {
      const item = ALL_PALETTE_ITEMS.find(p => p.type === type);
      if (!item) return;
      const cols = 4;
      nodes.push({
        id: getNodeId(type),
        type: 'pipelineNode',
        position: { x: (i % cols) * 220 + 80, y: Math.floor(i / cols) * 120 + 260 },
        data: { ...item, active: true, state: 'idle', config: nodeConfigs[type] || item.defaults || {} },
      });
    });

    nodes.push({
      id: 'alert-engine',
      type: 'pipelineNode', position: { x: 600, y: 650 },
      data: { type: 'alert-engine', label: 'Alert Engine', icon: '🔔', color: '#2b8e5c', active: true, state: 'idle', chat: notifyChat, email: notifyEmail },
    });

    if (notifyChat) {
      nodes.push({
        id: getNodeId('google-chat'),
        type: 'pipelineNode', position: { x: 460, y: 760 },
        data: { type: 'google-chat', label: 'Google Chat', icon: '📢', color: '#34A853', desc: 'Notificar', active: true, state: 'idle' },
      });
    }
    if (notifyEmail) {
      nodes.push({
        id: getNodeId('email-alert'),
        type: 'pipelineNode', position: { x: 740, y: 760 },
        data: { type: 'email-alert', label: 'Email Alert', icon: '📧', color: '#F59E0B', desc: 'Notificar email', active: true, state: 'idle' },
      });
    }

    return nodes;
  }, [keywordsStr, activeChannelTypes, schedule, timezone, notifyChat, notifyEmail, nodeConfigs]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  /* ── BUILD EDGES ── */
  const buildEdges = useCallback((currentNodes) => {
    const chIds = currentNodes.filter(n => {
      const t = n.data?.type;
      return t && !['keywords', 'schedule', 'alert-engine', 'google-chat', 'email-alert', 'ai-analysis'].includes(t);
    }).map(n => n.id);

    const alertIds = currentNodes.filter(n => n.id.startsWith('google-chat-') || n.id.startsWith('email-alert-')).map(n => n.id);

    const e = [];

    // Keywords → Schedule
    e.push({ id: 'kw-sch', source: 'keywords-in', target: 'schedule-node', animated: true,
      style: { stroke: '#6364FF', strokeWidth: 3 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#6364FF', width: 24, height: 24 } });

    // Schedule → each channel
    chIds.forEach(id => {
      e.push({ id: `sch-${id}`, source: 'schedule-node', target: id, animated: true,
        style: { stroke: '#ff5a1f', strokeWidth: 3 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#ff5a1f', width: 24, height: 24 } });
    });

    // Channels → Alert Engine
    chIds.forEach(id => {
      e.push({ id: `${id}-out`, source: id, target: 'alert-engine',
        style: { stroke: '#2b8e5c', strokeWidth: 3, strokeDasharray: '8 4' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#2b8e5c', width: 24, height: 24 } });
    });

    // Alert Engine → alerts
    alertIds.forEach(id => {
      e.push({ id: `alert-${id}`, source: 'alert-engine', target: id, animated: true,
        style: { stroke: '#F59E0B', strokeWidth: 3 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#F59E0B', width: 24, height: 24 } });
    });

    return e;
  }, []);

  useEffect(() => { setEdges(buildEdges(nodes)); }, [nodes, buildEdges, setEdges]);
  useEffect(() => { setNodes(initialNodes); }, [initialNodes, setNodes]);

  const onConnect = useCallback((p) => setEdges(eds => addEdge(p, eds)), [setEdges]);

  /* ── DRAG & DROP ── */
  const onDragOver = useCallback((e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);
  const onDrop = useCallback((e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/reactflow');
    if (!type || !reactFlowInstance) return;
    const pos = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const item = ALL_PALETTE_ITEMS.find(i => i.type === type);
    if (!item) return;
    setNodes(nds => [...nds, {
      id: getNodeId(type), type: 'pipelineNode', position: pos,
      data: { ...item, active: true, state: 'idle', config: item.defaults || {} },
    }]);
  }, [reactFlowInstance, setNodes]);

  const onKeyDown = useCallback((e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && nodes.find(n => n.selected && n.id !== 'keywords-in' && n.id !== 'alert-engine' && n.id !== 'schedule-node')) {
      setNodes(nds => nds.filter(n => !n.selected));
      setEdges(eds => eds.filter(ed => !nodes.find(n => n.selected && (ed.source === n.id || ed.target === n.id))));
    }
  }, [nodes, setNodes, setEdges]);

  /* ── NODE CLICK ── */
  const onNodeClick = useCallback((_, node) => {
    if (node.id === 'schedule-node') { setConfigNode('schedule-node'); return; }
    const type = node.data?.type;
    if (type && PALETTE_GROUPS[1]?.items?.some(i => i.type === type)) { setConfigNode(node.id); }
  }, []);

  /* ── RUN WITH ANIMATION ── */
  const runFlow = async () => {
    setFlowRunning(true);
    setRunProgress('Iniciando pipeline...');

    // Reset all nodes
    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, state: 'idle' } })));

    // 1. Keywords → pulse
    setNodes(nds => nds.map(n => n.id === 'keywords-in' ? { ...n, data: { ...n.data, state: 'running' } } : n));
    setRunProgress('📡 Keywords listos');
    await new Promise(r => setTimeout(r, 500));
    setNodes(nds => nds.map(n => n.id === 'keywords-in' ? { ...n, data: { ...n.data, state: 'done' } } : n));

    // 2. Schedule
    setNodes(nds => nds.map(n => n.id === 'schedule-node' ? { ...n, data: { ...n.data, state: 'running' } } : n));
    setRunProgress(`⏰ Schedule: cada ${schedule} min en ${timezone}`);
    await new Promise(r => setTimeout(r, 500));
    setNodes(nds => nds.map(n => n.id === 'schedule-node' ? { ...n, data: { ...n.data, state: 'done' } } : n));

    // 3. Channels sequentially
    const chNodes = nodes.filter(n => {
      const t = n.data?.type;
      return t && !['keywords', 'schedule', 'alert-engine', 'google-chat', 'email-alert', 'ai-analysis'].includes(t);
    });
    for (let i = 0; i < chNodes.length; i++) {
      const node = chNodes[i];
      setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, state: 'running' } } : n));
      setRunProgress(`🔍 Paso ${i + 1}/${chNodes.length} — ${node.data?.icon} ${node.data?.label}`);
      await new Promise(r => setTimeout(r, 800));
      setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, state: 'done' } } : n));
      await new Promise(r => setTimeout(r, 300));
    }

    // 4. Alert Engine
    setNodes(nds => nds.map(n => n.id === 'alert-engine' ? { ...n, data: { ...n.data, state: 'running' } } : n));
    setRunProgress('🔔 Procesando alertas...');
    if (onRun) await onRun();
    await new Promise(r => setTimeout(r, 500));
    setNodes(nds => nds.map(n => n.id === 'alert-engine' ? { ...n, data: { ...n.data, state: 'done' } } : n));

    // 5. Alert outputs
    const alertNodes = nodes.filter(n => n.id.startsWith('google-chat-') || n.id.startsWith('email-alert-'));
    for (const node of alertNodes) {
      setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, state: 'running' } } : n));
      setRunProgress(`📬 ${node.data?.label}`);
      await new Promise(r => setTimeout(r, 500));
      setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, state: 'done' } } : n));
    }

    setRunProgress('✅ Pipeline completado');
    setFlowRunning(false);
  };

  /* ── SAVE ── */
  const handleSave = async () => {
    setSaving(true);
    try {
      const chIds = [...new Set(nodes.filter(n => {
        const t = n.data?.type;
        return t && PALETTE_GROUPS[1]?.items?.some(i => i.type === t);
      }).map(n => n.data?.type))];

      if (onSave) await onSave({
        name: jobName,
        keywords: keywordsStr.split(',').map(k => k.trim()).filter(Boolean),
        channels: chIds,
        schedule_minutes: schedule,
        notify_google_chat: notifyChat,
        notify_email: notifyEmail,
      });
    } catch (e) { alert('Error: ' + e.message); }
    setSaving(false);
  };

  /* ── AI ── */
  const askAI = async () => {
    if (!aiInput.trim() || aiStreaming) return;
    setAiMessages(prev => [...prev, { role: 'user', text: aiInput }]);
    setAiInput('');
    setAiStreaming(true);
    try {
      const res = await fetch(`${API}/api/ai/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Contexto: configuro monitor "${jobName}" con keywords: ${keywordsStr}. Pregunta del usuario: ${aiInput}. Responde en español, con sugerencias prácticas.` }),
      });
      const data = await res.json();
      setAiMessages(prev => [...prev, { role: 'assistant', text: data.response || data.message || data.text || 'Sin respuesta' }]);
    } catch (e) { setAiMessages(prev => [...prev, { role: 'assistant', text: 'Error al consultar AI' }]); }
    setAiStreaming(false);
  };

  return (
    <div className="flex h-full w-full">
      {/* ── PALETTE ── */}
      <div className="w-[220px] flex-shrink-0 bg-[#faf8f6] dark:bg-[#12100e] border-r border-[rgba(32,24,19,0.08)] flex flex-col overflow-y-auto">
        <div className="px-4 py-3.5 border-b border-[rgba(32,24,19,0.06)]">
          <div className="flex items-center gap-2 mb-3">
            <button onClick={onBack} className="text-[#988d84] hover:text-[#201813] text-sm flex items-center gap-1">← Volver</button>
            <h2 className="font-syne text-[13px] text-[#201813] dark:text-[var(--ink)]">Pipeline</h2>
          </div>
          <input value={jobName} onChange={e => setJobName(e.target.value)}
            className="w-full px-3 py-2 rounded-[10px] border border-[rgba(32,24,19,0.12)] text-[12px] font-bold text-[#201813] dark:bg-[#0f0b09] dark:text-[var(--ink)] outline-none focus:border-[#ff5a1f] bg-white" placeholder="Nombre" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {PALETTE_GROUPS.map(group => (
            <div key={group.label}>
              <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#988d84] px-2 mb-1.5">{group.label}</div>
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <div key={item.type} draggable
                    onDragStart={e => { e.dataTransfer.setData('application/reactflow', item.type); e.dataTransfer.effectAllowed = 'move'; }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] cursor-grab hover:bg-white dark:hover:bg-[#0f0b09] hover:shadow-sm transition-all active:cursor-grabbing border border-transparent hover:border-[rgba(32,24,19,0.08)]">
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
          <button onClick={handleSave} disabled={saving}
            className="w-full py-2 rounded-[10px] bg-gradient-to-r from-[#ff5a1f] to-[#ff7c2b] text-white text-[12px] font-bold hover:shadow-lg transition-all disabled:opacity-50">
            {saving ? 'Guardando...' : '💾 Guardar'}
          </button>
        </div>
      </div>

      {/* ── CANVAS ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-5 py-2.5 bg-white dark:bg-[#1a1512] border-b border-[rgba(32,24,19,0.06)]">
          <div className="flex items-center gap-3 text-[11px]">
            <span><strong className="text-[#201813] dark:text-[var(--ink)]">{nodes.length}</strong> nodos</span>
            <span className="w-px h-3 bg-[rgba(32,24,19,0.1)]" />
            <span><strong className="text-[#201813] dark:text-[var(--ink)]">{edges.length}</strong> conexiones</span>
            {runProgress && <><span className="w-px h-3 bg-[rgba(32,24,19,0.1)]" /><span className="text-[#ff5a1f]">{runProgress}</span></>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAI(!showAI)}
              className="px-3 py-1.5 rounded-[8px] text-xs font-bold bg-[#8b63e7] text-white hover:bg-[#7a53d6] transition-all flex items-center gap-1.5">
              🤖 {showAI ? 'Cerrar' : 'AI'}
            </button>
            <button onClick={() => { setNodes(initialNodes); }}
              className="px-3 py-1.5 rounded-[8px] text-xs text-[#5f564f] hover:bg-[rgba(32,24,19,0.06)] transition-all">🔄 Reset</button>
            <button onClick={runFlow} disabled={flowRunning}
              className="px-4 py-1.5 rounded-[8px] text-xs font-bold bg-[#ff5a1f] text-white hover:bg-[#e04a10] transition-all disabled:opacity-50 flex items-center gap-1.5">
              {flowRunning ? <><span className="w-2 h-2 rounded-full bg-white animate-pulse-slow" /> • Ejecutando</> : '▶ Ejecutar'}
            </button>
          </div>
        </div>

        <div className="flex-1 relative" ref={reactFlowWrapper} tabIndex={0} onKeyDown={onKeyDown}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes} edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={onNodeClick}
              onInit={setReactFlowInstance}
              nodeTypes={nodeTypes}
              fitView minZoom={0.15} maxZoom={3}
              snapToGrid snapGrid={[20, 20]}
              attributionPosition="bottom-left"
              deleteKeyCode={['Delete', 'Backspace']}
              selectionOnDrag
              panOnDrag={[2]}
            >
              <Controls className="!rounded-[10px] !shadow-sm" />
              <MiniMap style={{ borderRadius: '12px', border: '1px solid rgba(32,24,19,0.08)' }}
                nodeColor={n => n.data?.color || '#666'} maskColor="rgba(0,0,0,0.04)" />
              <Background variant="lines" gap={24} size={1.5} color="rgba(32,24,19,0.08)" />

              {/* Floating config panel */}
              {configNode === 'schedule-node' && (
                <div className="absolute top-4 right-4 z-20" style={{ position: 'absolute', top: 16, right: 16 }}>
                  <ScheduleConfig schedule={schedule} timezone={timezone}
                    onChange={({ schedule: s, timezone: tz }) => { if (s !== undefined) setSchedule(s); if (tz) setTimezone(tz); }}
                    onClose={() => setConfigNode(null)} />
                </div>
              )}
              {configNode && configNode !== 'schedule-node' && (
                <div className="absolute top-4 right-4 z-20" style={{ position: 'absolute', top: 16, right: 16 }}>
                  <ChannelConfig type={nodes.find(n => n.id === configNode)?.data?.type || ''}
                    config={nodeConfigs[nodes.find(n => n.id === configNode)?.data?.type || ''] || {}}
                    onChange={(cfg) => {
                      const type = nodes.find(n => n.id === configNode)?.data?.type;
                      if (type) setNodeConfigs(prev => ({ ...prev, [type]: cfg }));
                    }}
                    onClose={() => setConfigNode(null)} />
                </div>
              )}
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </div>

      {/* ── AI PANEL ── */}
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
                  'Que canales recomiendas para visa?',
                  'Cuantos resultados por canal deberia poner?',
                  'Que frecuencia es mejor para monitoreo de marca?',
                ].map((q, i) => (
                  <button key={i} onClick={() => setAiInput(q)}
                    className="block w-full text-left px-3 py-2 rounded-[8px] bg-[rgba(32,24,19,0.04)] hover:bg-[rgba(255,90,31,0.08)] text-[#5f564f] transition-all text-[11px]">{q}</button>
                ))}
              </div>
            )}
            {aiMessages.map((msg, i) => (
              <div key={i} className={`p-3 rounded-[10px] ${msg.role === 'user' ? 'bg-[rgba(255,90,31,0.08)] ml-4' : 'bg-[rgba(32,24,19,0.04)] mr-4'}`}>
                <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#988d84] mb-1">{msg.role === 'user' ? 'Tú' : 'AI'}</div>
                <div className="text-[#201813] dark:text-[var(--ink)]">{msg.text}</div>
              </div>
            ))}
            {aiStreaming && <div className="text-center text-[#988d84] text-[11px]">Pensando...</div>}
          </div>
          <div className="px-4 py-3 border-t border-[rgba(32,24,19,0.06)] flex gap-2">
            <input value={aiInput} onChange={e => setAiInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && askAI()}
              className="flex-1 px-3 py-2 rounded-[10px] border border-[rgba(32,24,19,0.12)] text-[12px] outline-none focus:border-[#8b63e7] dark:bg-[#0f0b09] dark:text-[var(--ink)]"
              placeholder="Pregunta a la AI..." />
            <button onClick={askAI} disabled={aiStreaming} className="px-3 py-2 rounded-[10px] bg-[#8b63e7] text-white text-xs font-bold hover:bg-[#7a53d6] disabled:opacity-50">Enviar</button>
          </div>
        </div>
      )}
    </div>
  );
}
