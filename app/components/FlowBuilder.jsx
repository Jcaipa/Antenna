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
  Handle,
  Position,
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
  { type:'x', label:'X/Twitter', icon:'𝕏', color:'#1DA1F2' },
  { type:'reddit', label:'Reddit', icon:'🟠', color:'#FF4500' },
  { type:'news', label:'Noticias', icon:'📰', color:'#2D3748' },
  { type:'youtube', label:'YouTube', icon:'▶️', color:'#FF0000' },
  { type:'bluesky', label:'Bluesky', icon:'🦋', color:'#0085FF' },
  { type:'mastodon', label:'Mastodon', icon:'🐘', color:'#6364FF' },
  { type:'hacker_news', label:'Hacker News', icon:'🟧', color:'#FF6600' },
  { type:'tiktok', label:'TikTok', icon:'🎵', color:'#000' },
  { type:'google_alert', label:'Google Alerts', icon:'🔔', color:'#4285F4' },
  { type:'google_trends', label:'Trends', icon:'📈', color:'#4285F4' },
  { type:'google_serp', label:'SERP', icon:'🔍', color:'#34A853' },
  { type:'google_ads', label:'Google Ads', icon:'🎯', color:'#FBBC04' },
  { type:'meta_ads', label:'Meta Ads', icon:'📱', color:'#1877F2' },
  { type:'site_monitor', label:'Sitios Web', icon:'🌐', color:'#6B7280' },
];

const PALETTE = [
  { group:'Triggers', items:[
    { type:'schedule', label:'Schedule', icon:'⏰', color:'#6364FF', subtitle:'Cada X min en zona horaria' },
  ]},
  { group:'Input', items:[
    { type:'keywords', label:'Keywords', icon:'🔑', color:'#ff5a1f', subtitle:'Palabras clave a monitorear' },
  ]},
  { group:'Canales', items: CHANNEL_TYPES },
  { group:'Alertas', items:[
    { type:'google-chat', label:'Google Chat', icon:'📢', color:'#34A853', subtitle:'Notificar a Google Chat' },
    { type:'email-alert', label:'Email Alert', icon:'📧', color:'#F59E0B', subtitle:'Notificar por email' },
  ]},
];

/* ── N8N-STYLE NODE ── */
function N8nNode({ data, selected }) {
  const { label, icon, color, subtitle, type, state: st, config } = data;
  const isRunning = st === 'running';
  const isDone = st === 'done';
  const isTrigger = type === 'schedule';
  const isKW = type === 'keywords';
  const isOutput = type === 'alert-engine';
  const isAlert = type === 'google-chat' || type === 'email-alert';

  const statusColor = isDone ? '#10b981' : isRunning ? '#ff5a1f' : color;

  return (
    <div className={`bg-white rounded-[12px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border-2 transition-all duration-300 min-w-[180px] ${
      selected ? 'border-[#ff5a1f] shadow-[0_0_0_2px_rgba(255,90,31,0.2)]' : 'border-transparent'
    } ${isRunning ? 'shadow-[0_0_20px_rgba(255,90,31,0.3)]' : ''} ${isDone ? 'shadow-[0_0_15px_rgba(16,185,129,0.25)]' : ''}`}>
      {/* Top handle (input) */}
      {!isTrigger && <Handle type="target" position={Position.Top} className="!w-3 !h-3 !border-2 !border-white !shadow-sm"
        style={{ background: statusColor }} />}

      {/* Header bar */}
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-t-[10px]" style={{ background: `${color}12` }}>
        <span className="text-base">{isRunning ? '⏳' : isDone ? '✅' : icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold" style={{ color: isDone ? '#10b981' : color }}>{label}</div>
          {subtitle && <div className="text-[9px] text-[#988d84]">{subtitle}</div>}
          {isKW && data.kw && <div className="text-[9px] text-[#988d84] truncate">{data.kw}</div>}
          {isTrigger && data.sched && <div className="text-[9px] text-[rgba(255,255,255,0.7)]">{FREQ_LABELS[data.sched]} · {data.tz}</div>}
        </div>
        {config?.limit && <span className="text-[9px] text-[#988d84] bg-white/70 rounded px-1.5 py-0.5">{config.limit}</span>}
      </div>

      {/* Status indicator bar */}
      <div className="h-[3px] rounded-b-[10px] transition-all duration-500" style={{
        background: isDone ? '#10b981' : isRunning ? '#ff5a1f' : 'transparent',
        width: isDone ? '100%' : isRunning ? '60%' : '0%',
      }} />

      {/* Bottom handle (output) */}
      {!isOutput && !isAlert && (
        <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !border-2 !border-white !shadow-sm"
          style={{ background: statusColor }} />
      )}
    </div>
  );
}

const nodeTypes = { n8nNode: N8nNode };

/* ── CONFIG PANELS ── */
function KeywordsPanel({ kw, sched, tz, onChange, onClose }) {
  return (
    <div className="bg-white rounded-[14px] shadow-xl border p-5 w-[300px]">
      <div className="flex items-center justify-between mb-4">
        <span className="font-bold text-[14px] flex items-center gap-2">🔑 Keywords</span>
        <button onClick={onClose} className="text-[#988d84] hover:text-[#000]">✕</button>
      </div>
      <label className="block mb-3">
        <span className="text-[10px] font-bold uppercase text-[#988d84] block mb-1">Keywords</span>
        <input value={kw} onChange={e => onChange({...{sched,tz}, kw:e.target.value})}
          className="w-full px-3 py-2 rounded-[8px] border text-[13px] outline-none focus:border-[#ff5a1f]" />
      </label>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <label className="block">
          <span className="text-[10px] font-bold uppercase text-[#988d84] block mb-1">Cada</span>
          <select value={sched} onChange={e => onChange({...{kw,tz}, sched:parseInt(e.target.value)})}
            className="w-full px-3 py-2 rounded-[8px] border text-[12px] outline-none bg-white">
            {Object.entries(FREQ_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase text-[#988d84] block mb-1">Zona</span>
          <select value={tz} onChange={e => onChange({...{kw,sched}, tz:e.target.value})}
            className="w-full px-3 py-2 rounded-[8px] border text-[12px] outline-none bg-white">
            {TIMEZONES.map(tz=> <option key={tz} value={tz}>{tz.replace(/_/g,' ')}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

function ChannelPanel({ type, config, onChange, onClose }) {
  const item = CHANNEL_TYPES.find(c => c.type === type);
  if (!item) return null;
  const c = config || {};
  return (
    <div className="bg-white rounded-[14px] shadow-xl border p-5 w-[280px]">
      <div className="flex items-center justify-between mb-4">
        <span className="font-bold text-[14px] flex items-center gap-2"><span>{item.icon}</span><span style={{color:item.color}}>{item.label}</span></span>
        <button onClick={onClose} className="text-[#988d84] hover:text-[#000]">✕</button>
      </div>
      <label className="block mb-3">
        <span className="text-[10px] font-bold uppercase text-[#988d84] block mb-1">Resultados</span>
        <input type="range" min={5} max={200} step={5} value={c.limit||50}
          onChange={e => onChange({...c, limit:parseInt(e.target.value)})}
          className="w-full accent-[#ff5a1f]" />
        <span className="text-[12px] font-bold text-right block">{c.limit||50}</span>
      </label>
      <label className="block mb-2">
        <span className="text-[10px] font-bold uppercase text-[#988d84] block mb-1">Orden</span>
        <select value={c.sort||'relevance'} onChange={e => onChange({...c, sort:e.target.value})}
          className="w-full px-3 py-2 rounded-[8px] border text-[12px] outline-none bg-white">
          <option value="relevance">Relevancia</option>
          <option value="recent">Reciente</option>
          <option value="top">Top</option>
        </select>
      </label>
    </div>
  );
}

/* ── MAIN ── */
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
  const [runningIndex, setRunningIndex] = useState(-1);
  const [showConfig, setShowConfig] = useState('');
  const [nodeData, setNodeData] = useState({});
  const [saving, setSaving] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [aiMsg, setAiMsg] = useState([]);
  const [aiInp, setAiInp] = useState('');
  const [aiStr, setAiStr] = useState(false);
  const wrapper = useRef(null);
  const [rfi, setRfi] = useState(null);
  const nodeIdCnt = useRef(Date.now());
  const nid = (t) => `${t}-${++nodeIdCnt.current}`;

  const defConfigs = useMemo(() => Object.fromEntries(CHANNEL_TYPES.map(c => [c.type, { limit:50, sort:'relevance' }])), []);

  // Build nodes from job
  const initialNodes = useMemo(() => {
    const ns = [];
    ns.push({ id:'trigger', type:'n8nNode', position:{ x:300, y:20 },
      data:{ type:'schedule', label:'Schedule', icon:'⏰', color:'#6364FF', subtitle:'Cada X min', state:'idle', sched:schedule, tz:timezone } });
    ns.push({ id:'kw', type:'n8nNode', position:{ x:300, y:140 },
      data:{ type:'keywords', label:'Keywords', icon:'🔑', color:'#ff5a1f', subtitle:'Palabras clave', state:'idle', kw:keywordsStr } });
    activeChannelTypes.forEach((t,i) => {
      const ch = CHANNEL_TYPES.find(c=>c.type===t);
      if (!ch) return;
      ns.push({ id:`ch-${t}`, type:'n8nNode', position:{ x:150+(i%3)*200, y:300+Math.floor(i/3)*120 },
        data:{...ch, state:'idle', config: nodeData[t]||defConfigs[t]||{ limit:50 } } });
    });
    const oy = activeChannelTypes.length > 0 ? 350 + Math.ceil(activeChannelTypes.length/3)*120 : 300;
    ns.push({ id:'engine', type:'n8nNode', position:{ x:300, y:oy },
      data:{ type:'alert-engine', label:'Alert Engine', icon:'🔔', color:'#2b8e5c', subtitle:'Procesa y notifica', state:'idle' } });
    if (notifyChat) ns.push({ id:'chat', type:'n8nNode', position:{ x:160, y:oy+110 },
      data:{ type:'google-chat', label:'Google Chat', icon:'📢', color:'#34A853', subtitle:'Notificar', state:'idle' } });
    if (notifyEmail) ns.push({ id:'email', type:'n8nNode', position:{ x:420, y:oy+110 },
      data:{ type:'email-alert', label:'Email Alert', icon:'📧', color:'#F59E0B', subtitle:'Notificar email', state:'idle' } });
    return ns;
  }, [keywordsStr, activeChannelTypes, schedule, timezone, notifyChat, notifyEmail, nodeData, defConfigs]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const buildEdges = useCallback((ns) => {
    const e = [];
    const addE = (src, tgt, color, anim=false) => {
      e.push({ id:`e-${src}-${tgt}`, source:src, target:tgt, animated:anim,
        style:{ stroke:color, strokeWidth:2.5 },
        markerEnd:{ type:MarkerType.ArrowClosed, color, width:20, height:20 } });
    };
    addE('trigger','kw','#6364FF', true);
    ns.filter(n => n.id.startsWith('ch-')).forEach(n => addE('kw', n.id, '#ff5a1f', true));
    ns.filter(n => n.id.startsWith('ch-')).forEach(n => addE(n.id, 'engine', '#2b8e5c', false));
    if (notifyChat) addE('engine','chat','#34A853', true);
    if (notifyEmail) addE('engine','email','#F59E0B', true);
    return e;
  }, [notifyChat, notifyEmail]);

  useEffect(() => { setEdges(buildEdges(nodes)); }, [nodes, buildEdges, setEdges]);
  useEffect(() => { setNodes(initialNodes); }, [initialNodes, setNodes]);

  const onConnect = useCallback((p) => setEdges(eds => addEdge(p, eds)), [setEdges]);

  const onDragOver = useCallback((e) => { e.preventDefault(); e.dataTransfer.dropEffect='move'; }, []);
  const onDrop = useCallback((e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('app/node');
    if (!type || !rfi) return;
    const pos = rfi.screenToFlowPosition({ x:e.clientX, y:e.clientY });
    const item = PALETTE.flatMap(g=>g.items).find(i=>i.type===type);
    if (!item) return;
    setNodes(nds => [...nds, { id:nid(type), type:'n8nNode', position:pos,
      data:{ ...item, state:'idle', config:defConfigs[type]||{ limit:50 } } }]);
  }, [rfi, setNodes, defConfigs]);

  const onNodeClick = useCallback((_, n) => {
    if (n.id==='kw' || n.id==='trigger') setShowConfig('kw');
    else if (n.id.startsWith('ch-')) setShowConfig(n.id);
  }, []);

  const onKeyDown = useCallback((e) => {
    if ((e.key==='Delete'||e.key==='Backspace') && nodes.find(n=>n.selected && !['trigger','kw','engine'].includes(n.id)))
      setNodes(nds => nds.filter(n => !n.selected));
  }, [nodes, setNodes]);

  const runFlow = async () => {
    setFlowRunning(true);
    setRunningIndex(-1);
    setNodes(nds => nds.map(n => ({...n, data:{...n.data, state:'idle'}})));
    const steps = [
      { id:'trigger', label:'Schedule', msg:'Iniciando schedule...' },
      { id:'kw', label:'Keywords', msg:'Keywords listas' },
      ...activeChannelTypes.map(t => ({ id:`ch-${t}`, label:CHANNEL_TYPES.find(c=>c.type===t)?.label||t, msg:`Buscando en ${CHANNEL_TYPES.find(c=>c.type===t)?.label||t}...` })),
      { id:'engine', label:'Alert Engine', msg:'Procesando...' },
    ];
    if (notifyChat) steps.push({ id:'chat', label:'Google Chat', msg:'Notificando Chat...' });
    if (notifyEmail) steps.push({ id:'email', label:'Email', msg:'Notificando email...' });

    for (let i=0; i<steps.length; i++) {
      setRunningIndex(i);
      setRunProgress(steps[i].msg);
      setNodes(nds => nds.map(n => n.id===steps[i].id ? {...n, data:{...n.data, state:'running'}} : n));
      await new Promise(r => setTimeout(r, 600));
      setNodes(nds => nds.map(n => n.id===steps[i].id ? {...n, data:{...n.data, state:'done'}} : n));
      await new Promise(r => setTimeout(r, 300));
    }
    if (onRun) await onRun();
    setRunProgress('✅ Completado');
    setFlowRunning(false);
    setRunningIndex(-1);
    setTimeout(() => setRunProgress(''), 3000);
  };

  const save = async () => {
    setSaving(true);
    const ch = [...new Set(nodes.filter(n=>n.id.startsWith('ch-')).map(n=>n.data?.type))];
    try {
      if (onSave) await onSave({
        name:jobName, keywords:keywordsStr.split(',').map(k=>k.trim()).filter(Boolean),
        channels:ch, schedule_minutes:schedule,
        notify_google_chat:notifyChat, notify_email:notifyEmail,
      });
    } catch(e) { alert('Error: '+e.message); }
    setSaving(false);
  };

  const askAI = async () => {
    if (!aiInp.trim()||aiStr) return;
    setAiMsg(p=>[...p,{role:'user',text:aiInp}]); setAiInp(''); setAiStr(true);
    try {
      const r = await fetch(`${API}/api/ai/chat`, { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({message:`Contexto: monitor "${jobName}" keywords:${keywordsStr}. ${aiInp}. Español.`}) });
      const d = await r.json();
      setAiMsg(p=>[...p,{role:'assistant',text:d.response||d.message||d.text||'Sin respuesta'}]);
    } catch { setAiMsg(p=>[...p,{role:'assistant',text:'Error AI'}]); }
    setAiStr(false);
  };

  return (
    <div className="flex h-full w-full bg-[#f8f8f8]">
      {/* LEFT: Mini palette */}
      <div className="w-[180px] flex-shrink-0 bg-white border-r flex flex-col">
        <div className="p-3 border-b">
          <button onClick={onBack} className="text-[#888] hover:text-[#000] text-xs mb-2 flex items-center gap-1">← Volver</button>
          <input value={jobName} onChange={e=>setJobName(e.target.value)}
            className="w-full px-3 py-1.5 rounded-[8px] border text-[12px] font-bold outline-none focus:border-[#ff5a1f]" placeholder="Nombre" />
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {PALETTE.map(g => (
            <div key={g.group}>
              <div className="text-[8px] font-bold uppercase text-[#988d84] mb-1">{g.group}</div>
              {g.items.map(item => (
                <div key={item.type} draggable
                  onDragStart={e => { e.dataTransfer.setData('app/node', item.type); e.dataTransfer.effectAllowed='move'; }}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-[8px] cursor-grab hover:bg-[#f5f5f5] active:cursor-grabbing text-[11px] font-bold transition-all"
                  style={{ color: item.color }}>
                  <span>{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="p-3 border-t space-y-2">
          <button onClick={save} disabled={saving}
            className="w-full py-2 rounded-[8px] bg-gradient-to-r from-[#ff5a1f] to-[#ff7c2b] text-white text-[12px] font-bold disabled:opacity-50">
            {saving ? 'Guardando...' : '💾 Guardar'}
          </button>
          <button onClick={()=>setShowAI(!showAI)}
            className="w-full py-2 rounded-[8px] bg-[#8b63e7] text-white text-[12px] font-bold">🤖 AI</button>
        </div>
      </div>

      {/* CENTER: Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b text-[11px]">
          <div className="flex items-center gap-3">
            <span><strong>{nodes.length}</strong> nodos</span>
            <span className="w-px h-3 bg-[rgba(0,0,0,0.1)]" />
            <span><strong>{edges.length}</strong> conexiones</span>
            {runProgress && <><span className="w-px h-3 bg-[rgba(0,0,0,0.1)]" /><span className="text-[#ff5a1f] font-bold">{runProgress}</span></>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#988d84]">Arrastra nodos desde la paleta</span>
            <button onClick={()=>{setNodes(initialNodes); setShowConfig('')}}
              className="px-3 py-1 rounded-[6px] text-[11px] text-[#666] hover:bg-[#f0f0f0]">↻ Reset</button>
            <button onClick={runFlow} disabled={flowRunning}
              className="px-4 py-1.5 rounded-[8px] text-[12px] font-bold bg-[#ff5a1f] text-white hover:bg-[#e04a10] disabled:opacity-50 flex items-center gap-1">
              {flowRunning ? <><span className="w-2 h-2 rounded-full bg-white animate-pulse-slow" /> Ejecutando</> : '▶ Ejecutar'}
            </button>
          </div>
        </div>

        <div className="flex-1 relative" ref={wrapper} tabIndex={0} onKeyDown={onKeyDown}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes} edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={onNodeClick}
              onInit={setRfi}
              nodeTypes={nodeTypes}
              fitView minZoom={0.15} maxZoom={3}
              snapToGrid snapGrid={[20,20]}
              attributionPosition="bottom-left"
              deleteKeyCode={['Delete','Backspace']}
              defaultEdgeOptions={{ style:{ strokeWidth:2.5, stroke:'#888' }, markerEnd:{ type:MarkerType.ArrowClosed, color:'#888' } }}
            >
              <Controls showInteractive={false} className="!rounded-[8px]" />
              <MiniMap style={{ borderRadius:'10px', border:'1px solid rgba(0,0,0,0.08)' }}
                nodeColor={n=>n.data?.color||'#666'} maskColor="rgba(0,0,0,0.04)" />
              <Background variant="dots" gap={20} size={1} color="rgba(0,0,0,0.06)" />

              {showConfig==='kw' && (
                <div className="absolute top-3 left-3 z-20">
                  <KeywordsPanel kw={keywordsStr} sched={schedule} tz={timezone}
                    onChange={({kw,sched,tz}) => { if(kw!==undefined) setKeywordsStr(kw); if(sched) setSchedule(sched); if(tz) setTimezone(tz); }}
                    onClose={() => setShowConfig('')} />
                </div>
              )}
              {showConfig && showConfig!=='kw' && (
                <div className="absolute top-3 left-3 z-20">
                  <ChannelPanel type={nodes.find(n=>n.id===showConfig)?.data?.type||''}
                    config={nodeData[nodes.find(n=>n.id===showConfig)?.data?.type||'']||{}}
                    onChange={cfg => setNodeData(p=>({...p, [nodes.find(n=>n.id===showConfig)?.data?.type||'']:cfg}))}
                    onClose={() => setShowConfig('')} />
                </div>
              )}
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </div>

      {/* RIGHT: Progress (only when running) */}
      {flowRunning && (
        <div className="w-[180px] flex-shrink-0 bg-white border-l p-3">
          <div className="text-[10px] font-bold uppercase text-[#988d84] mb-3">Progreso</div>
          {[
            { id:'trigger', icon:'⏰', label:'Schedule' },
            { id:'kw', icon:'🔑', label:'Keywords' },
            ...activeChannelTypes.map(t => ({ id:`ch-${t}`, icon:CHANNEL_TYPES.find(c=>c.type===t)?.icon||'📡', label:CHANNEL_TYPES.find(c=>c.type===t)?.label||t })),
            { id:'engine', icon:'🔔', label:'Alert Engine' },
            ...(notifyChat ? [{ id:'chat', icon:'📢', label:'Google Chat' }] : []),
            ...(notifyEmail ? [{ id:'email', icon:'📧', label:'Email' }] : []),
          ].map((s,i) => (
            <div key={s.id} className={`flex items-center gap-2 p-1.5 rounded-[6px] mb-1 text-[11px] ${
              i===runningIndex ? 'bg-[rgba(255,90,31,0.08)] text-[#ff5a1f] font-bold' : i<runningIndex ? 'text-[#10b981]' : 'text-[#999]'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] ${
                i<runningIndex ? 'bg-[#10b981] text-white' : i===runningIndex ? 'bg-[#ff5a1f] text-white animate-pulse' : 'bg-[#eee]'
              }`}>{i<runningIndex ? '✓' : ''}</span>
              {s.icon} {s.label}
            </div>
          ))}
        </div>
      )}

      {/* AI panel */}
      {showAI && (
        <div className="w-[260px] flex-shrink-0 bg-white border-l flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-[12px] font-bold">🤖 AI</span>
            <button onClick={()=>setShowAI(false)} className="text-[#888]">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 text-[12px]">
            {aiMsg.length===0 && (
              <div className="text-center py-4 text-[#888] space-y-1.5 text-[11px]">
                <p>Pregunta sobre tu pipeline:</p>
                {['Que canales recomiendas para visa?','Cuantos resultados poner por canal?','Mejor frecuencia?'].map((q,i) => (
                  <button key={i} onClick={()=>setAiInp(q)}
                    className="block w-full text-left px-2 py-1.5 rounded-[6px] bg-[#f5f5f5] hover:bg-[rgba(255,90,31,0.08)] transition-all">{q}</button>
                ))}
              </div>
            )}
            {aiMsg.map((m,i) => (
              <div key={i} className={`p-2 rounded-[8px] ${m.role==='user'?'bg-[rgba(255,90,31,0.08)] ml-3':'bg-[#f5f5f5] mr-3'}`}>
                <div className="text-[8px] font-bold uppercase text-[#888] mb-0.5">{m.role==='user'?'Tu':'AI'}</div>
                <div>{m.text}</div>
              </div>
            ))}
            {aiStr && <div className="text-center text-[#888] text-[11px]">Pensando...</div>}
          </div>
          <div className="p-3 border-t flex gap-1.5">
            <input value={aiInp} onChange={e=>setAiInp(e.target.value)} onKeyDown={e=>e.key==='Enter'&&askAI()}
              className="flex-1 px-2.5 py-1.5 rounded-[6px] border text-[12px] outline-none focus:border-[#8b63e7]" placeholder="Pregunta..." />
            <button onClick={askAI} disabled={aiStr} className="px-3 py-1.5 rounded-[6px] bg-[#8b63e7] text-white text-[11px] font-bold disabled:opacity-50">→</button>
          </div>
        </div>
      )}
    </div>
  );
}
