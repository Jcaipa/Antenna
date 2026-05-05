'use client';
import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const TIMEZONES = [
  'America/Bogota','America/Mexico_City','America/Argentina/Buenos_Aires',
  'America/Santiago','America/Lima','America/Caracas',
  'America/New_York','America/Chicago','America/Los_Angeles',
  'Europe/Madrid','Europe/London','Europe/Paris','UTC',
];
const FREQ_LABELS = { 30:'30 min',60:'1 hora',120:'2 horas',360:'6 horas',720:'12 horas',1440:'24 horas' };

const CHANNEL_TYPES = [
  { type:'x', label:'X/Twitter', icon:'𝕏', color:'#1DA1F2', desc:'Perfiles y tweets' },
  { type:'reddit', label:'Reddit', icon:'🟠', color:'#FF4500', desc:'Posts y comentarios' },
  { type:'news', label:'Noticias', icon:'📰', color:'#2D3748', desc:'Google News' },
  { type:'youtube', label:'YouTube', icon:'▶️', color:'#FF0000', desc:'Videos' },
  { type:'bluesky', label:'Bluesky', icon:'🦋', color:'#0085FF', desc:'Posts publicos' },
  { type:'mastodon', label:'Mastodon', icon:'🐘', color:'#6364FF', desc:'Fediverso' },
  { type:'hacker_news', label:'Hacker News', icon:'🟧', color:'#FF6600', desc:'Discusiones' },
  { type:'tiktok', label:'TikTok', icon:'🎵', color:'#000000', desc:'Videos' },
  { type:'google_alert', label:'Google Alerts', icon:'🔔', color:'#4285F4', desc:'RSS feeds' },
  { type:'google_trends', label:'Trends', icon:'📈', color:'#4285F4', desc:'Tendencias' },
  { type:'google_serp', label:'SERP', icon:'🔍', color:'#34A853', desc:'Rankings' },
  { type:'google_ads', label:'Google Ads', icon:'🎯', color:'#FBBC04', desc:'Anuncios' },
  { type:'meta_ads', label:'Meta Ads', icon:'📱', color:'#1877F2', desc:'FB + IG' },
  { type:'site_monitor', label:'Sitios Web', icon:'🌐', color:'#6B7280', desc:'Cambios visuales' },
];

/* ── CUSTOM NODE ── */
function StepNode({ data }) {
  const { label, icon, color, desc, stage, stepNum, totalSteps, state: st, config } = data;
  const isRunning = st === 'running';
  const isDone = st === 'done';
  const isError = st === 'error';

  const baseStyle = `px-4 py-3 rounded-[16px] select-none shadow-md transition-all duration-500 min-w-[170px] ${
    isRunning ? 'animate-pulse shadow-[0_0_25px_rgba(255,90,31,0.4)]' : ''
  } ${isDone ? 'shadow-[0_0_20px_rgba(16,185,129,0.3)]' : ''}`;

  if (stage === 'trigger') {
    return (
      <div className={`${baseStyle}`} style={{ background:'linear-gradient(135deg,#6364FF,#8586FF)', color:'#fff', border: isDone ? '2px solid #10b981' : '2px solid transparent' }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">⏰</span>
          <span className="text-[13px] font-bold">{data.schedule ? `Cada ${FREQ_LABELS[data.schedule] || data.schedule+'min'}` : 'Schedule'}</span>
        </div>
        {data.timezone && <div className="text-[10px] opacity-70">{data.timezone}</div>}
        {isDone && <div className="text-[10px] text-green-300 font-bold mt-1">✓ Activo</div>}
        <div className="text-[8px] opacity-50 mt-1 font-bold">PASO {stepNum}/{totalSteps} — TRIGGER</div>
      </div>
    );
  }

  if (stage === 'input') {
    return (
      <div className={`${baseStyle} cursor-pointer`} style={{ background:'linear-gradient(135deg,#ff5a1f,#ff7c2b)', color:'#fff', border: isDone ? '2px solid #10b981' : '2px solid transparent' }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">🔑</span>
          <span className="text-[13px] font-bold">Keywords</span>
        </div>
        <div className="text-[11px] opacity-80 leading-tight">{data.keywords || 'visa, inmigracion'}</div>
        <div className="text-[8px] opacity-50 mt-1.5 font-bold">PASO {stepNum}/{totalSteps} — INPUT</div>
      </div>
    );
  }

  if (stage === 'output') {
    return (
      <div className={baseStyle} style={{ background:'linear-gradient(135deg,#1a6b3c,#2b8e5c)', color:'#fff', border: isDone ? '2px solid #10b981' : '2px solid transparent' }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">🔔</span>
          <span className="text-[13px] font-bold">Alert Engine</span>
        </div>
        <div className="flex gap-1.5 mt-1">
          {data.chat && <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded-[4px]">📢 Chat</span>}
          {data.email && <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded-[4px]">📧 Email</span>}
        </div>
        <div className="text-[8px] opacity-50 mt-1 font-bold">PASO {stepNum}/{totalSteps} — OUTPUT</div>
      </div>
    );
  }

  // Channel node
  return (
    <div className={`${baseStyle} cursor-pointer`} style={{
      background: isDone ? '#f0fdf4' : `${color}12`,
      border: isDone ? '2px solid #10b981' : isRunning ? `2px solid ${color}` : `2px solid ${color}40`,
    }}>
      <div className="flex items-center gap-2.5">
        <span className="text-lg">{isRunning ? '⏳' : isDone ? '✅' : icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-bold" style={{ color: isDone ? '#10b981' : color }}>{label}</div>
          <div className="text-[9px] text-[#988d84] truncate">{desc}</div>
        </div>
        {config?.limit && <span className="text-[9px] text-[#988d84] bg-white/70 rounded-[4px] px-1.5 py-0.5">{config.limit}</span>}
      </div>
      <div className="text-[8px] text-[#988d84] mt-1 font-bold">PASO {stepNum}/{totalSteps}</div>
    </div>
  );
}

const nodeTypes = { stepNode: StepNode };

/* ── KEYWORDS CONFIG PANEL ── */
function KeywordsConfig({ keywordsStr, schedule, timezone, onChange, onClose }) {
  return (
    <div className="bg-white dark:bg-[#1a1512] rounded-[16px] shadow-xl border border-[rgba(32,24,19,0.12)] p-5 w-[320px]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#ff5a1f] to-[#ff7c2b] grid place-items-center text-white">🔑</span>
          <h3 className="font-syne text-[15px] text-[#201813] dark:text-[var(--ink)]">Configurar Monitor</h3>
        </div>
        <button onClick={onClose} className="text-[#988d84] hover:text-[#201813]">✕</button>
      </div>

      <label className="block mb-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#988d84] block mb-1.5">Keywords</span>
        <textarea value={keywordsStr} onChange={e => onChange({ keywordsStr: e.target.value })}
          className="w-full px-3 py-2 rounded-[10px] border border-[rgba(32,24,19,0.12)] text-[12px] text-[#201813] dark:bg-[#0f0b09] dark:text-[var(--ink)] outline-none focus:border-[#ff5a1f] resize-none h-[60px] bg-white"
          placeholder="visa, inmigracion, Estados Unidos" />
      </label>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#988d84] block mb-1.5">Frecuencia</span>
          <select value={schedule} onChange={e => onChange({ schedule: parseInt(e.target.value) })}
            className="w-full px-3 py-2 rounded-[8px] border border-[rgba(32,24,19,0.12)] text-[12px] text-[#201813] dark:bg-[#0f0b09] dark:text-[var(--ink)] outline-none bg-white">
            {Object.entries(FREQ_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#988d84] block mb-1.5">Zona Horaria</span>
          <select value={timezone} onChange={e => onChange({ timezone: e.target.value })}
            className="w-full px-3 py-2 rounded-[8px] border border-[rgba(32,24,19,0.12)] text-[12px] text-[#201813] dark:bg-[#0f0b09] dark:text-[var(--ink)] outline-none bg-white">
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace(/_/g,' ')}</option>)}
          </select>
        </label>
      </div>

      <div className="text-[10px] text-[#988d84] bg-[rgba(32,24,19,0.04)] rounded-[8px] p-2.5 leading-relaxed">
        El monitor se ejecutara <strong>cada {FREQ_LABELS[schedule] || schedule+' min'}</strong> en zona <strong>{timezone}</strong>.
        Buscara resultados para <strong>{keywordsStr || 'las keywords definidas'}</strong> en los canales activos del pipeline.
      </div>
    </div>
  );
}

/* ── CHANNEL CONFIG PANEL ── */
function ChannelConfigPanel({ type, config, onChange, onClose }) {
  const item = CHANNEL_TYPES.find(p => p.type === type);
  if (!item) return null;
  const c = config || {};
  return (
    <div className="bg-white dark:bg-[#1a1512] rounded-[16px] shadow-xl border border-[rgba(32,24,19,0.12)] p-5 w-[280px]">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[13px] font-bold flex items-center gap-2">
          <span className="text-lg">{item.icon}</span>
          <span style={{ color: item.color }}>{item.label}</span>
        </span>
        <button onClick={onClose} className="text-[#988d84] hover:text-[#201813]">✕</button>
      </div>

      <label className="block mb-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#988d84] block mb-1">Resultados a traer</span>
        <div className="flex items-center gap-3">
          <input type="range" min={5} max={200} step={5} value={c.limit || 50}
            onChange={e => onChange({...c, limit: parseInt(e.target.value)})}
            className="flex-1 accent-[#ff5a1f]" />
          <span className="text-[13px] font-bold text-[#201813] dark:text-[var(--ink)] min-w-[32px] text-right">{c.limit || 50}</span>
        </div>
        <div className="flex justify-between text-[9px] text-[#988d84] mt-0.5">
          <span>Mín: 5</span>
          <span>Recom: {item.type === 'news' || item.type === 'youtube' ? 25 : 50}</span>
          <span>Máx: 200</span>
        </div>
      </label>

      {c.sort && (
        <label className="block mb-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#988d84] block mb-1">Ordenar por</span>
          <select value={c.sort || 'relevance'} onChange={e => onChange({...c, sort: e.target.value})}
            className="w-full px-3 py-2 rounded-[8px] border border-[rgba(32,24,19,0.12)] text-[12px] text-[#201813] dark:bg-[#0f0b09] dark:text-[var(--ink)] outline-none bg-white">
            <option value="relevance">Relevancia</option>
            <option value="recent">Mas reciente</option>
            <option value="top">Top / Popular</option>
          </select>
        </label>
      )}

      <label className="block mb-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#988d84] block mb-1">Idioma</span>
        <select value={c.language || 'auto'} onChange={e => onChange({...c, language: e.target.value})}
          className="w-full px-3 py-2 rounded-[8px] border border-[rgba(32,24,19,0.12)] text-[12px] text-[#201813] dark:bg-[#0f0b09] dark:text-[var(--ink)] outline-none bg-white">
          <option value="auto">Auto</option>
          <option value="es">Espanol</option>
          <option value="en">English</option>
          <option value="pt">Portugues</option>
        </select>
      </label>
    </div>
  );
}

/* ── PROGRESS SIDEBAR ── */
function ProgressSidebar({ steps, currentStep, runProgress, flowRunning }) {
  if (!flowRunning) return null;
  return (
    <div className="w-[200px] flex-shrink-0 bg-white dark:bg-[#1a1512] border-l border-[rgba(32,24,19,0.08)] p-4 overflow-y-auto">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#988d84] mb-3">Progreso del Pipeline</h3>
      <div className="space-y-2">
        {steps.map((s, i) => {
          const isActive = i === currentStep;
          const isPast = i < currentStep;
          return (
            <div key={i} className={`flex items-center gap-2.5 p-2 rounded-[8px] transition-all ${
              isActive ? 'bg-[rgba(255,90,31,0.08)]' : isPast ? 'bg-[rgba(16,185,129,0.06)]' : ''
            }`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                isPast ? 'bg-[#10b981] text-white' : isActive ? 'bg-[#ff5a1f] text-white animate-pulse' : 'bg-[rgba(32,24,19,0.06)] text-[#988d84]'
              }`}>
                {isPast ? '✓' : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`text-[11px] font-bold truncate ${isActive ? 'text-[#ff5a1f]' : isPast ? 'text-[#10b981]' : 'text-[#5f564f]'}`}>
                  {s.icon} {s.label}
                </div>
                {isActive && <div className="text-[9px] text-[#988d84] truncate">{runProgress}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── MAIN FLOW BUILDER ── */
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
  const [currentStep, setCurrentStep] = useState(-1);
  const [showAI, setShowAI] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiStreaming, setAiStreaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showConfig, setShowConfig] = useState(''); // '' | 'keywords' | channelType
  const [nodeConfigs, setNodeConfigs] = useState({});
  const reactFlowWrapper = useRef(null);
  const [rfInstance, setRfInstance] = useState(null);

  /* ── BUILD STEPS ── */
  const steps = useMemo(() => {
    const s = [
      { icon: '⏰', label: 'Trigger', key: 'schedule' },
      { icon: '🔑', label: 'Keywords', key: 'keywords' },
      ...activeChannelTypes.map(t => {
        const ch = CHANNEL_TYPES.find(c => c.type === t);
        return { icon: ch?.icon || '📡', label: ch?.label || t, key: t };
      }),
      { icon: '🔔', label: 'Alert Engine', key: 'output' },
    ];
    if (notifyChat) s.push({ icon: '📢', label: 'Google Chat', key: 'chat' });
    if (notifyEmail) s.push({ icon: '📧', label: 'Email', key: 'email' });
    return s;
  }, [activeChannelTypes, notifyChat, notifyEmail]);

  /* ── BUILD NODES WITH STAGED LAYOUT ── */
  const flowNodes = useMemo(() => {
    const nodes = [];
    const midX = Math.max(3, activeChannelTypes.length) * 130;

    // Stage 1: Trigger (Schedule)
    nodes.push({
      id: 'trigger', type: 'stepNode', position: { x: midX - 80, y: 20 },
      data: { stage:'trigger', label:'Schedule', icon:'⏰', color:'#6364FF', schedule, timezone,
        stepNum:1, totalSteps:steps.length, state:'idle' },
    });

    // Stage 2: Input (Keywords)
    nodes.push({
      id: 'keywords-in', type: 'stepNode', position: { x: midX - 80, y: 140 },
      data: { stage:'input', label:'Keywords', icon:'🔑', color:'#ff5a1f', keywords:keywordsStr,
        stepNum:2, totalSteps:steps.length, state:'idle' },
    });

    // Stage 3: Channels (horizontal row)
    const cols = Math.min(4, activeChannelTypes.length);
    activeChannelTypes.forEach((type, i) => {
      const ch = CHANNEL_TYPES.find(c => c.type === type);
      if (!ch) return;
      const col = i % cols;
      const row = Math.floor(i / cols);
      nodes.push({
        id: `ch-${type}`,
        type: 'stepNode',
        position: { x: col * 200 + 50, y: row * 100 + 280 },
        data: { ...ch, stage:'channel', stepNum:3 + i, totalSteps:steps.length, state:'idle',
          config: nodeConfigs[type] || { limit: ch.type === 'news' ? 25 : 50, sort: 'relevance', language: 'auto' } },
      });
    });

    // Stage 4: Output (Alert Engine)
    const outputY = 280 + (Math.ceil(activeChannelTypes.length / cols) * 100) + 80;
    nodes.push({
      id: 'alert-engine', type: 'stepNode', position: { x: midX - 90, y: outputY },
      data: { stage:'output', label:'Alert Engine', icon:'🔔', color:'#2b8e5c', chat:notifyChat, email:notifyEmail,
        stepNum: steps.findIndex(s => s.key==='output') + 1, totalSteps:steps.length, state:'idle' },
    });

    // Alert outputs
    let alertOffset = 0;
    if (notifyChat) {
      nodes.push({
        id: 'chat-out', type: 'stepNode', position: { x: midX - 160, y: outputY + 100 },
        data: { stage:'alert', label:'Google Chat', icon:'📢', color:'#34A853', desc:'Notificar a Chat',
          stepNum: steps.findIndex(s => s.key==='chat') + 1, totalSteps:steps.length, state:'idle' },
      });
      alertOffset = 1;
    }
    if (notifyEmail) {
      nodes.push({
        id: 'email-out', type: 'stepNode', position: { x: midX + 20, y: outputY + 100 },
        data: { stage:'alert', label:'Email Alert', icon:'📧', color:'#F59E0B', desc:'Notificar email',
          stepNum: steps.findIndex(s => s.key==='email') + 1, totalSteps:steps.length, state:'idle' },
      });
    }

    return nodes;
  }, [keywordsStr, activeChannelTypes, schedule, timezone, notifyChat, notifyEmail, nodeConfigs, steps.length]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  /* ── BUILD EDGES ── */
  useEffect(() => {
    const e = [];

    // Style by stage
    const edgeStyle = (color, dashed = false) => ({
      stroke: color, strokeWidth: 3,
      strokeDasharray: dashed ? '8 4' : 'none',
    });
    const marker = (color) => ({ type: MarkerType.ArrowClosed, color, width: 22, height: 22 });

    // Trigger → Keywords
    e.push({ id:'e-trigger-kw', source:'trigger', target:'keywords-in', animated:true,
      ...edgeStyle('#6364FF'), markerEnd: marker('#6364FF') });

    // Keywords → each channel
    activeChannelTypes.forEach((type, i) => {
      e.push({ id:`e-kw-${type}`, source:'keywords-in', target:`ch-${type}`, animated:true,
        ...edgeStyle('#ff5a1f'), markerEnd: marker('#ff5a1f') });
    });

    // Each channel → Alert Engine
    activeChannelTypes.forEach(type => {
      e.push({ id:`e-${type}-out`, source:`ch-${type}`, target:'alert-engine',
        ...edgeStyle('#2b8e5c', true), markerEnd: marker('#2b8e5c') });
    });

    // Alert Engine → outputs
    if (notifyChat) e.push({ id:'e-alert-chat', source:'alert-engine', target:'chat-out', animated:true,
      ...edgeStyle('#34A853'), markerEnd: marker('#34A853') });
    if (notifyEmail) e.push({ id:'e-alert-email', source:'alert-engine', target:'email-out', animated:true,
      ...edgeStyle('#F59E0B'), markerEnd: marker('#F59E0B') });

    setEdges(e);
  }, [activeChannelTypes, notifyChat, notifyEmail, setEdges]);

  useEffect(() => { setNodes(flowNodes); }, [flowNodes, setNodes]);

  /* ── NODE CLICK ── */
  const onNodeClick = useCallback((_, node) => {
    if (node.id === 'trigger' || node.id === 'keywords-in') { setShowConfig('keywords'); }
    else if (node.id.startsWith('ch-')) { setShowConfig(node.id.replace('ch-','')); }
  }, []);

  /* ── RUN ── */
  const runFlow = async () => {
    setFlowRunning(true);
    setCurrentStep(-1);
    setRunProgress('Iniciando...');
    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, state:'idle' } })));

    const stepNodes = [
      { id:'trigger', label:'Schedule', icon:'⏰', msg:'Validando schedule...' },
      { id:'keywords-in', label:'Keywords', icon:'🔑', msg:'Keywords listas' },
      ...activeChannelTypes.map(type => ({
        id:`ch-${type}`, label: CHANNEL_TYPES.find(c=>c.type===type)?.label || type,
        icon: CHANNEL_TYPES.find(c=>c.type===type)?.icon || '📡',
        msg: `Buscando en ${CHANNEL_TYPES.find(c=>c.type===type)?.label || type}...`,
      })),
      { id:'alert-engine', label:'Alert Engine', icon:'🔔', msg:'Procesando alertas...' },
    ];
    if (notifyChat) stepNodes.push({ id:'chat-out', label:'Google Chat', icon:'📢', msg:'Notificando a Google Chat...' });
    if (notifyEmail) stepNodes.push({ id:'email-out', label:'Email Alert', icon:'📧', msg:'Notificando por email...' });

    for (let i = 0; i < stepNodes.length; i++) {
      const sn = stepNodes[i];
      setCurrentStep(i);
      setRunProgress(sn.msg);
      setNodes(nds => nds.map(n => n.id === sn.id ? { ...n, data: { ...n.data, state:'running' } } : n));
      await new Promise(r => setTimeout(r, 700));
      setNodes(nds => nds.map(n => n.id === sn.id ? { ...n, data: { ...n.data, state:'done' } } : n));
      await new Promise(r => setTimeout(r, 300));
    }

    if (onRun) await onRun();
    setRunProgress('✅ Pipeline completado');
    setFlowRunning(false);
    setCurrentStep(-1);
    setTimeout(() => setRunProgress(''), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    const chIds = [...new Set(nodes.filter(n => n.id.startsWith('ch-')).map(n => n.data?.type))];
    try {
      if (onSave) await onSave({
        name: jobName,
        keywords: keywordsStr.split(',').map(k => k.trim()).filter(Boolean),
        channels: chIds,
        schedule_minutes: schedule,
        notify_google_chat: notifyChat,
        notify_email: notifyEmail,
      });
    } catch (e) { alert('Error: '+e.message); }
    setSaving(false);
  };

  /* ── AI ── */
  const askAI = async () => {
    if (!aiInput.trim() || aiStreaming) return;
    setAiMessages(p => [...p, { role:'user', text:aiInput }]);
    setAiInput('');
    setAiStreaming(true);
    try {
      const res = await fetch(`${API}/api/ai/chat`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ message:`Contexto: monitor "${jobName}" keywords:${keywordsStr} canales:${activeChannelTypes.join(',')} schedule:${schedule}min. Pregunta: ${aiInput}. Responde en espanol, sugerencias practicas.` }),
      });
      const d = await res.json();
      setAiMessages(p => [...p, { role:'assistant', text: d.response || d.message || d.text || 'Sin respuesta' }]);
    } catch { setAiMessages(p => [...p, { role:'assistant', text:'Error AI' }]); }
    setAiStreaming(false);
  };

  return (
    <div className="flex h-full w-full">
      {/* LEFT: Job name & save */}
      <div className="w-[180px] flex-shrink-0 bg-[#faf8f6] dark:bg-[#12100e] border-r border-[rgba(32,24,19,0.08)] flex flex-col">
        <div className="p-4 border-b border-[rgba(32,24,19,0.06)]">
          <button onClick={onBack} className="text-[#988d84] hover:text-[#201813] text-sm flex items-center gap-1 mb-3">← Volver</button>
          <input value={jobName} onChange={e => setJobName(e.target.value)}
            className="w-full px-3 py-2 rounded-[10px] border border-[rgba(32,24,19,0.12)] text-[12px] font-bold text-[#201813] dark:bg-[#0f0b09] dark:text-[var(--ink)] outline-none focus:border-[#ff5a1f] bg-white" placeholder="Nombre" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#988d84] mb-3">Canales</div>
          <div className="space-y-1">
            {CHANNEL_TYPES.map(ch => {
              const active = activeChannelTypes.includes(ch.type);
              return (
                <div key={ch.type}
                  onClick={() => {
                    if (active) setShowConfig(ch.type);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-[10px] transition-all cursor-pointer ${
                    active ? 'bg-white dark:bg-[#0f0b09] shadow-sm border border-[rgba(32,24,19,0.08)]' : 'opacity-35 hover:opacity-60'
                  }`}
                  draggable
                  onDragStart={e => { e.dataTransfer.setData('text/plain', ch.type); }}
                >
                  <span className="text-base">{ch.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold" style={{ color: active ? ch.color : '#999' }}>{ch.label}</div>
                  </div>
                  <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center ${active ? 'bg-[#2b8e5c] border-[#2b8e5c]' : 'border-[#ddd]'}`}>
                    {active && <span className="text-white text-[8px] font-bold">✓</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="p-4 border-t border-[rgba(32,24,19,0.06)]">
          <button onClick={handleSave} disabled={saving}
            className="w-full py-2.5 rounded-[10px] bg-gradient-to-r from-[#ff5a1f] to-[#ff7c2b] text-white text-[12px] font-bold hover:shadow-lg transition-all disabled:opacity-50">
            {saving ? 'Guardando...' : '💾 Guardar'}
          </button>
          <button onClick={() => setShowAI(!showAI)}
            className="w-full py-2 mt-2 rounded-[10px] bg-[#8b63e7] text-white text-[12px] font-bold hover:bg-[#7a53d6] transition-all">
            🤖 AI
          </button>
        </div>
      </div>

      {/* CENTER: CANVAS */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-5 py-2.5 bg-white dark:bg-[#1a1512] border-b border-[rgba(32,24,19,0.06)]">
          <div className="flex items-center gap-3 text-[11px]">
            <span><strong className="text-[#201813]">{nodes.length}</strong> nodos</span>
            <span className="w-px h-3 bg-[rgba(32,24,19,0.1)]" />
            <span><strong>{edges.length}</strong> conexiones</span>
            <span className="w-px h-3 bg-[rgba(32,24,19,0.1)]" />
            <span className="text-[#988d84]">{steps.length} pasos</span>
            {runProgress && <><span className="w-px h-3 bg-[rgba(32,24,19,0.1)]" /><span className="text-[#ff5a1f] font-bold">{runProgress}</span></>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setNodes(flowNodes); setShowConfig(''); }}
              className="px-3 py-1.5 rounded-[8px] text-xs text-[#5f564f] hover:bg-[rgba(32,24,19,0.06)] transition-all">🔄 Reset</button>
            <button onClick={runFlow} disabled={flowRunning}
              className="px-4 py-1.5 rounded-[8px] text-xs font-bold bg-[#ff5a1f] text-white hover:bg-[#e04a10] transition-all disabled:opacity-50 flex items-center gap-1.5">
              {flowRunning ? <><span className="w-2 h-2 rounded-full bg-white animate-pulse-slow" /> Corriendo</> : '▶ Ejecutar Pipeline'}
            </button>
          </div>
        </div>

        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes} edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onInit={setRfInstance}
              nodeTypes={nodeTypes}
              fitView minZoom={0.2} maxZoom={2.5}
              attributionPosition="bottom-left"
              panOnDrag={[2]}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
            >
              <Controls className="!rounded-[10px] !shadow-sm" showInteractive={false} />
              <MiniMap style={{ borderRadius:'12px', border:'1px solid rgba(32,24,19,0.08)' }}
                nodeColor={n => n.data?.color || '#666'} maskColor="rgba(0,0,0,0.04)" />
              <Background variant="lines" gap={24} size={1.5} color="rgba(32,24,19,0.08)" />

              {/* Config panels overlay */}
              {showConfig === 'keywords' && (
                <div className="absolute top-4 left-4 z-20" style={{ position:'absolute', top:16, left:16 }}>
                  <KeywordsConfig
                    keywordsStr={keywordsStr} schedule={schedule} timezone={timezone}
                    onChange={({ keywordsStr:ks, schedule:s, timezone:tz }) => {
                      if (ks !== undefined) setKeywordsStr(ks);
                      if (s !== undefined) setSchedule(s);
                      if (tz) setTimezone(tz);
                    }}
                    onClose={() => setShowConfig('')} />
                </div>
              )}
              {showConfig && showConfig !== 'keywords' && (
                <div className="absolute top-4 left-4 z-20" style={{ position:'absolute', top:16, left:16 }}>
                  <ChannelConfigPanel
                    type={showConfig}
                    config={nodeConfigs[showConfig] || {}}
                    onChange={cfg => setNodeConfigs(p => ({ ...p, [showConfig]: cfg }))}
                    onClose={() => setShowConfig('')} />
                </div>
              )}
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </div>

      {/* RIGHT: Progress sidebar */}
      <ProgressSidebar steps={steps} currentStep={currentStep} runProgress={runProgress} flowRunning={flowRunning} />

      {/* AI PANEL (when toggled) */}
      {showAI && (
        <div className="w-[280px] flex-shrink-0 bg-white dark:bg-[#1a1512] border-l border-[rgba(32,24,19,0.08)] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(32,24,19,0.06)]">
            <h3 className="text-[13px] font-bold">🤖 AI Assistant</h3>
            <button onClick={() => setShowAI(false)} className="text-[#988d84] hover:text-[#201813]">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-[12px]">
            {aiMessages.length === 0 && (
              <div className="text-center py-6 text-[#988d84] space-y-2">
                <p className="text-[11px]">Pregunta sobre tu pipeline:</p>
                {['Que canales recomiendas para monitorear "visa"?','Configura 14 canales para tech','Mejores practicas para frecuencia'].map((q,i) => (
                  <button key={i} onClick={() => setAiInput(q)}
                    className="block w-full text-left px-3 py-2 rounded-[8px] bg-[rgba(32,24,19,0.04)] hover:bg-[rgba(255,90,31,0.08)] text-[#5f564f] transition-all text-[11px]">{q}</button>
                ))}
              </div>
            )}
            {aiMessages.map((msg,i) => (
              <div key={i} className={`p-3 rounded-[10px] ${msg.role==='user'?'bg-[rgba(255,90,31,0.08)] ml-4':'bg-[rgba(32,24,19,0.04)] mr-4'}`}>
                <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#988d84] mb-1">{msg.role==='user'?'Tu':'AI'}</div>
                <div className="text-[#201813] dark:text-[var(--ink)]">{msg.text}</div>
              </div>
            ))}
            {aiStreaming && <div className="text-center text-[#988d84] text-[11px]">Pensando...</div>}
          </div>
          <div className="px-4 py-3 border-t border-[rgba(32,24,19,0.06)] flex gap-2">
            <input value={aiInput} onChange={e => setAiInput(e.target.value)} onKeyDown={e => e.key==='Enter' && askAI()}
              className="flex-1 px-3 py-2 rounded-[10px] border border-[rgba(32,24,19,0.12)] text-[12px] outline-none focus:border-[#8b63e7] dark:bg-[#0f0b09] dark:text-[var(--ink)]"
              placeholder="Pregunta..." />
            <button onClick={askAI} disabled={aiStreaming} className="px-3 py-2 rounded-[10px] bg-[#8b63e7] text-white text-xs font-bold hover:bg-[#7a53d6] disabled:opacity-50">Enviar</button>
          </div>
        </div>
      )}
    </div>
  );
}
