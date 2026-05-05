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

const TZ = ['America/Bogota','America/Mexico_City','America/Argentina/Buenos_Aires','America/Santiago','America/Lima','America/New_York','America/Chicago','America/Los_Angeles','Europe/Madrid','Europe/London','Europe/Paris','UTC'];
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
  { group:'Triggers', items:[{ type:'schedule', label:'Schedule', icon:'⏰', color:'#6364FF' }]},
  { group:'Input', items:[{ type:'keywords', label:'Keywords', icon:'🔑', color:'#ff5a1f' }]},
  { group:'Canales', items:CHANNEL_TYPES },
  { group:'Alertas', items:[
    { type:'google-chat', label:'Google Chat', icon:'📢', color:'#34A853' },
    { type:'email-alert', label:'Email Alert', icon:'📧', color:'#F59E0B' },
  ]},
];

/* ── N8N NODE ── */
function N8nNode({ data }) {
  const { label, icon, color, type, state:st, config, kw, sched, tz } = data;
  const isRun = st==='running'; const isDone = st==='done';
  const isTrig = type==='schedule'; const isKW = type==='keywords'; const isOut = type==='alert-engine';

  return (
    <div className={`bg-white rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] border-2 transition-all duration-300 min-w-[160px] ${
      isRun ? 'border-[#ff5a1f] shadow-[0_0_20px_rgba(255,90,31,0.3)]' : isDone ? 'border-[#10b981]' : 'border-transparent'
    }`}>
      {/* HANDLES — lado izquierdo (target/input) y derecho (source/output) */}
      {!isTrig && <Handle type="target" position={Position.Left} className="!w-3 !h-3 !border-2 !border-white !shadow-sm" style={{ background: isDone?'#10b981':isRun?'#ff5a1f':color, left: -6 }} />}
      {!isOut && <Handle type="source" position={Position.Right} className="!w-3 !h-3 !border-2 !border-white !shadow-sm" style={{ background: isDone?'#10b981':isRun?'#ff5a1f':color, right: -6 }} />}

      <div className="flex items-center gap-2 px-3 py-2.5 rounded-t-[8px]" style={{ background:`${color}10` }}>
        <span className="text-base">{isRun ? '⏳' : isDone ? '✅' : icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-bold" style={{ color:isDone?'#10b981':color }}>{label}</div>
          {isKW && <div className="flex flex-wrap gap-1 mt-1 max-w-[200px]">{kw?.split(',').filter(Boolean).slice(0, 4).map((k,i)=><span key={i} className="text-[8px] bg-[rgba(255,90,31,0.15)] text-[#ff5a1f] px-1.5 py-0.5 rounded-[4px] font-bold truncate max-w-[80px]">{k.trim()}</span>)}</div>}
          {isTrig && <div className="text-[9px] text-[#888]">{sched?FREQ_LABELS[sched]:'—'} · {tz||'UTC'}</div>}
        </div>
        {config?.limit && <span className="text-[9px] text-[#888] bg-[#f5f5f5] rounded px-1.5 py-0.5">{config.limit}</span>}
      </div>
    </div>
  );
}

const nodeTypes = { n8nNode: N8nNode };

/* ── PANELS ── */
function KWP({ kwArr = [], sched, tz, onChange, onClose }) {
  const [inputVal, setInputVal] = useState('');
  
  const addKw = () => {
    const trimmed = inputVal.trim();
    if (!trimmed || kwArr.includes(trimmed)) return;
    onChange({ kwArr: [...kwArr, trimmed], sched, tz });
    setInputVal('');
  };

  const removeKw = (idx) => {
    onChange({ kwArr: kwArr.filter((_, i) => i !== idx), sched, tz });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addKw(); }
  };

  return (
    <div className="bg-white rounded-[14px] shadow-xl border p-5 w-[340px]">
      <div className="flex justify-between items-center mb-4">
        <span className="font-bold text-[15px] flex items-center gap-2">🔑 Keywords</span>
        <button onClick={onClose} className="text-[#888] hover:text-[#000] text-lg">✕</button>
      </div>

      <label className="block mb-3">
        <span className="text-[10px] font-bold uppercase text-[#888] block mb-1.5">Agregar keywords</span>
        <div className="flex gap-1.5">
          <input value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Escribe y presiona Enter"
            className="flex-1 px-3 py-2 rounded-[8px] border text-[13px] outline-none focus:border-[#ff5a1f]" />
          <button onClick={addKw} className="px-3 py-2 rounded-[8px] bg-[#ff5a1f] text-white text-[13px] font-bold hover:bg-[#e04a10]">+</button>
        </div>
        <div className="text-[10px] text-[#888] mt-1">Presiona Enter para agregar cada keyword</div>
      </label>

      {kwArr.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3 p-3 bg-[#f8f6f4] rounded-[8px] max-h-[180px] overflow-y-auto">
          {kwArr.map((kw, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[20px] bg-white border text-[12px] font-bold shadow-sm" style={{ borderColor: '#ff5a1f', color: '#ff5a1f' }}>
              {kw}
              <button onClick={() => removeKw(i)} className="text-[#888] hover:text-[#ff5a1f] ml-0.5 text-[14px] leading-none">×</button>
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[10px] font-bold uppercase text-[#888] block mb-1">Cada</span>
          <select value={sched} onChange={e => onChange({ kwArr, sched: parseInt(e.target.value), tz })}
            className="w-full px-3 py-2 rounded-[8px] border text-[12px] outline-none bg-white">
            {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase text-[#888] block mb-1">Zona</span>
          <select value={tz} onChange={e => onChange({ kwArr, sched, tz: e.target.value })}
            className="w-full px-3 py-2 rounded-[8px] border text-[12px] outline-none bg-white">
            {TZ.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </label>
      </div>

      <div className="text-[11px] text-[#888] bg-[rgba(32,24,19,0.04)] rounded-[8px] p-3 mt-3 leading-relaxed">
        <strong>{kwArr.length}</strong> keywords configuradas · 
        Se ejecutará <strong>cada {FREQ_LABELS[sched] || sched + ' min'}</strong> en <strong>{tz}</strong>
      </div>
    </div>
  );
}
function CHP({ type, config, onChange, onClose }) {
  const item = CHANNEL_TYPES.find(c=>c.type===type); if(!item) return null;
  const c = config||{};
  return (
    <div className="bg-white rounded-[12px] shadow-xl border p-4 w-[250px]">
      <div className="flex justify-between mb-3"><span className="font-bold text-[13px] flex items-center gap-2"><span>{item.icon}</span><span style={{color:item.color}}>{item.label}</span></span><button onClick={onClose} className="text-[#888]">✕</button></div>
      <label className="block mb-2"><span className="text-[9px] font-bold uppercase text-[#888] block mb-1">Resultados</span>
        <div className="flex items-center gap-2"><input type="range" min={5} max={200} step={5} value={c.limit||50} onChange={e=>onChange({...c,limit:parseInt(e.target.value)})} className="flex-1 accent-[#ff5a1f]" /><span className="text-[13px] font-bold w-8 text-right">{c.limit||50}</span></div></label>
      <label className="block"><span className="text-[9px] font-bold uppercase text-[#888] block mb-1">Orden</span>
        <select value={c.sort||'relevance'} onChange={e=>onChange({...c,sort:e.target.value})} className="w-full px-3 py-1.5 rounded-[6px] border text-[11px] outline-none bg-white">
          <option value="relevance">Relevancia</option><option value="recent">Reciente</option><option value="top">Top</option></select></label>
    </div>
  );
}

/* ── MAIN ── */
export default function FlowBuilder({ job, onRun, onSave, onBack }) {
  const [jobName, setJobName] = useState(job?.name||'');
  const [keywordsArr, setKeywordsArr] = useState((typeof job?.keywords==='string'?JSON.parse(job.keywords):job?.keywords)||[]);
  const activeCh = (typeof job?.channels==='string'?JSON.parse(job.channels):job?.channels)||[];
  const [sched, setSched] = useState(job?.schedule_minutes||60);
  const [tz, setTz] = useState('America/Bogota');
  const [notifyChat, setNotifyChat] = useState(job?.notify_google_chat??true);
  const [notifyEmail, setNotifyEmail] = useState(job?.notify_email??false);
  const [flowRunning, setFlowRunning] = useState(false);
  const [runProg, setRunProg] = useState('');
  const [runIdx, setRunIdx] = useState(-1);
  const [showCfg, setShowCfg] = useState('');
  const [nodeData, setNodeData] = useState({});
  const [saving, setSaving] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [aiM, setAiM] = useState([]);
  const [aiI, setAiI] = useState('');
  const [aiS, setAiS] = useState(false);
  const wrapper = useRef(null);
  const [rfi, setRfi] = useState(null);
  const nid = t=>`${t}-${++idc.current}`; const idc = useRef(Date.now());

  const defC = useMemo(()=>Object.fromEntries(CHANNEL_TYPES.map(c=>[c.type,{limit:50,sort:'relevance'}])),[]);

  /* ── HORIZONTAL LAYOUT (left → right) ── */
  const hLayout = useMemo(() => {
    const n = [];
    n.push({ id:'trigger', type:'n8nNode', position:{ x:30, y:150 }, data:{ type:'schedule', label:'Schedule', icon:'⏰', color:'#6364FF', state:'idle', sched, tz } });
    n.push({ id:'kw', type:'n8nNode', position:{ x:230, y:150 }, data:{ type:'keywords', label:'Keywords', icon:'🔑', color:'#ff5a1f', state:'idle', kw:keywordsArr.join(', ') } });
    const maxPerCol = 4;
    const chW = 200; const chH = 85;
    activeCh.forEach((t,i) => {
      const ch = CHANNEL_TYPES.find(c=>c.type===t); if(!ch) return;
      n.push({ id:`ch-${t}`, type:'n8nNode', position:{ x:450, y:30 + (i%maxPerCol)*chH }, data:{...ch, state:'idle', config:nodeData[t]||defC[t]||{limit:50}} });
    });
    const engY = Math.min(activeCh.length, maxPerCol) > 0 ? 30 + Math.min(activeCh.length, maxPerCol) * chH / 2 : 150;
    n.push({ id:'engine', type:'n8nNode', position:{ x:680, y:engY }, data:{ type:'alert-engine', label:'Alert Engine', icon:'🔔', color:'#2b8e5c', state:'idle' } });
    if(notifyChat) n.push({ id:'chat', type:'n8nNode', position:{ x:880, y:engY-30 }, data:{ type:'google-chat', label:'Google Chat', icon:'📢', color:'#34A853', state:'idle' } });
    if(notifyEmail) n.push({ id:'email', type:'n8nNode', position:{ x:880, y:engY+30 }, data:{ type:'email-alert', label:'Email Alert', icon:'📧', color:'#F59E0B', state:'idle' } });
    return n;
  }, [keywordsArr, activeCh, sched, tz, notifyChat, notifyEmail, nodeData, defC]);

  /* ── VERTICAL LAYOUT (top → bottom) ── */
  const vLayout = useMemo(() => {
    const n = [];
    n.push({ id:'trigger', type:'n8nNode', position:{ x:250, y:20 }, data:{ type:'schedule', label:'Schedule', icon:'⏰', color:'#6364FF', state:'idle', sched, tz } });
    n.push({ id:'kw', type:'n8nNode', position:{ x:250, y:130 }, data:{ type:'keywords', label:'Keywords', icon:'🔑', color:'#ff5a1f', state:'idle', kw:keywordsArr.join(', ') } });
    const cols = 3;
    activeCh.forEach((t,i) => {
      const ch = CHANNEL_TYPES.find(c=>c.type===t); if(!ch) return;
      n.push({ id:`ch-${t}`, type:'n8nNode', position:{ x:30+(i%cols)*200, y:270+Math.floor(i/cols)*100 }, data:{...ch, state:'idle', config:nodeData[t]||defC[t]||{limit:50}} });
    });
    const oy = activeCh.length > 0 ? 290 + Math.ceil(activeCh.length/cols)*100 : 290;
    n.push({ id:'engine', type:'n8nNode', position:{ x:250, y:oy }, data:{ type:'alert-engine', label:'Alert Engine', icon:'🔔', color:'#2b8e5c', state:'idle' } });
    if(notifyChat) n.push({ id:'chat', type:'n8nNode', position:{ x:150, y:oy+110 }, data:{ type:'google-chat', label:'Google Chat', icon:'📢', color:'#34A853', state:'idle' } });
    if(notifyEmail) n.push({ id:'email', type:'n8nNode', position:{ x:350, y:oy+110 }, data:{ type:'email-alert', label:'Email Alert', icon:'📧', color:'#F59E0B', state:'idle' } });
    return n;
  }, [keywordsArr, activeCh, sched, tz, notifyChat, notifyEmail, nodeData, defC]);

  const [layoutHoriz, setLayoutHoriz] = useState(true);
  const initialNodes = layoutHoriz ? hLayout : vLayout;
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const buildEdges = useCallback((ns) => {
    const e = [];
    const mk = (src,tgt,color,anim=false) => {
      e.push({ id:`e-${src}-${tgt}`, source:src, target:tgt, animated:anim, type:'smoothstep',
        style:{ stroke:color, strokeWidth:2.5 },
        markerEnd:{ type:MarkerType.ArrowClosed, color, width:18, height:18 } });
    };
    mk('trigger','kw','#6364FF',true);
    ns.filter(n=>n.id.startsWith('ch-')).forEach(n=>mk('kw',n.id,'#ff5a1f',true));
    ns.filter(n=>n.id.startsWith('ch-')).forEach(n=>mk(n.id,'engine','#2b8e5c',false));
    if(notifyChat) mk('engine','chat','#34A853',true);
    if(notifyEmail) mk('engine','email','#F59E0B',true);
    return e;
  }, [notifyChat, notifyEmail]);

  useEffect(()=>{setEdges(buildEdges(nodes));},[nodes,buildEdges,setEdges]);
  useEffect(()=>{setNodes(initialNodes);},[initialNodes,setNodes]);

  const onConnect = useCallback((p)=>setEdges(eds=>addEdge(p,eds)),[]);
  const onDragOver = useCallback(e=>{e.preventDefault();e.dataTransfer.dropEffect='move';},[]);
  const onDrop = useCallback(e=>{
    e.preventDefault();
    const type = e.dataTransfer.getData('app/node');
    if(!type||!rfi) return;
    const pos = rfi.screenToFlowPosition({x:e.clientX,y:e.clientY});
    const item = PALETTE.flatMap(g=>g.items).find(i=>i.type===type);
    if(!item) return;
    setNodes(nds=>[...nds,{id:nid(type),type:'n8nNode',position:pos,data:{...item,state:'idle',config:defC[type]||{limit:50}}}]);
  },[rfi,setNodes,defC]);

  const onNodeClick = useCallback((_,n)=>{
    if(n.id==='kw'||n.id==='trigger') setShowCfg('kw');
    else if(n.id.startsWith('ch-')) setShowCfg(n.id);
  },[]);

  const onKeyDown = useCallback(e=>{
    if((e.key==='Delete'||e.key==='Backspace')&&nodes.find(n=>n.selected&&!['trigger','kw','engine'].includes(n.id)))
      setNodes(nds=>nds.filter(n=>!n.selected));
  },[nodes,setNodes]);

  const runFlow = async()=>{
    setFlowRunning(true); setRunIdx(-1); setNodes(nds=>nds.map(n=>({...n,data:{...n.data,state:'idle'}})));
    const steps = [
      {id:'trigger',msg:'Iniciando...'},
      {id:'kw',msg:'Keywords listas'},
      ...activeCh.map(t=>({id:`ch-${t}`,msg:`Buscando en ${CHANNEL_TYPES.find(c=>c.type===t)?.label||t}...`})),
      {id:'engine',msg:'Procesando alertas...'},
    ];
    if(notifyChat) steps.push({id:'chat',msg:'Notificando Chat...'});
    if(notifyEmail) steps.push({id:'email',msg:'Notificando email...'});
    for(let i=0;i<steps.length;i++){
      setRunIdx(i); setRunProg(steps[i].msg);
      setNodes(nds=>nds.map(n=>n.id===steps[i].id?{...n,data:{...n.data,state:'running'}}:n));
      await new Promise(r=>setTimeout(r,500));
      setNodes(nds=>nds.map(n=>n.id===steps[i].id?{...n,data:{...n.data,state:'done'}}:n));
      await new Promise(r=>setTimeout(r,300));
    }
    if(onRun) await onRun();
    setRunProg('✅ Completado'); setFlowRunning(false); setRunIdx(-1);
    setTimeout(()=>setRunProg(''),3000);
  };

  const save = async()=>{
    setSaving(true);
    const ch = [...new Set(nodes.filter(n=>n.id.startsWith('ch-')).map(n=>n.data?.type))];
    try{
      if(onSave) await onSave({name:jobName,keywords:keywordsArr,channels:ch,schedule_minutes:sched,notify_google_chat:notifyChat,notify_email:notifyEmail});
    }catch(e){alert('Error: '+e.message);}
    setSaving(false);
  };

  const askAI = async()=>{
    if(!aiI.trim()||aiS) return;
    setAiM(p=>[...p,{role:'user',text:aiI}]); setAiI(''); setAiS(true);
    try{
      const r = await fetch(`${API}/api/ai/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:`Contexto: monitor "${jobName}" keywords:${keywordsArr.join(", ")}. ${aiI}. Espanol.`})});
      const d = await r.json();
      setAiM(p=>[...p,{role:'assistant',text:d.response||d.message||d.text||'Sin respuesta'}]);
    }catch{setAiM(p=>[...p,{role:'assistant',text:'Error AI'}]);}
    setAiS(false);
  };

  return (
    <div className="flex h-full w-full bg-[#fafafa]">
      {/* LEFT */}
      <div className="w-[170px] flex-shrink-0 bg-white border-r flex flex-col">
        <div className="p-3 border-b">
          <button onClick={onBack} className="text-[#888] hover:text-[#000] text-xs mb-2 flex items-center gap-1">← Volver</button>
          <input value={jobName} onChange={e=>setJobName(e.target.value)} className="w-full px-2.5 py-1.5 rounded-[6px] border text-[11px] font-bold outline-none focus:border-[#ff5a1f]" placeholder="Nombre" />
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {PALETTE.map(g=>(
            <div key={g.group}>
              <div className="text-[8px] font-bold uppercase text-[#888] mb-1">{g.group}</div>
              {g.items.map(item=>(
                <div key={item.type} draggable
                  onDragStart={e=>{e.dataTransfer.setData('app/node',item.type);e.dataTransfer.effectAllowed='move';}}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] cursor-grab hover:bg-[#f5f5f5] active:cursor-grabbing text-[11px] font-bold transition-all" style={{color:item.color}}>
                  <span>{item.icon}</span><span className="truncate">{item.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="p-3 border-t space-y-2">
          <button onClick={save} disabled={saving} className="w-full py-2 rounded-[8px] bg-gradient-to-r from-[#ff5a1f] to-[#ff7c2b] text-white text-[11px] font-bold disabled:opacity-50">{saving?'Guardando...':'💾 Guardar'}</button>
          <button onClick={()=>setShowAI(!showAI)} className="w-full py-2 rounded-[8px] bg-[#8b63e7] text-white text-[11px] font-bold">🤖 AI</button>
        </div>
      </div>

      {/* CENTER */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b text-[11px]">
          <div className="flex items-center gap-3">
            <span><strong>{nodes.length}</strong> nodos</span>
            <span className="w-px h-3 bg-[rgba(0,0,0,0.1)]"/>
            <span><strong>{edges.length}</strong> conexiones</span>
            {runProg&&<><span className="w-px h-3 bg-[rgba(0,0,0,0.1)]"/><span className="text-[#ff5a1f] font-bold">{runProg}</span></>}
          </div>
          <div className="flex items-center gap-2">
            {/* Layout toggle */}
            <div className="flex bg-[#f0f0f0] rounded-[6px] p-0.5">
              <button onClick={()=>setLayoutHoriz(true)} className={`px-2.5 py-1 rounded-[5px] text-[10px] font-bold transition-all ${layoutHoriz?'bg-white shadow-sm':'text-[#888]'}`}>↔ Horizontal</button>
              <button onClick={()=>setLayoutHoriz(false)} className={`px-2.5 py-1 rounded-[5px] text-[10px] font-bold transition-all ${!layoutHoriz?'bg-white shadow-sm':'text-[#888]'}`}>↕ Vertical</button>
            </div>
            <button onClick={()=>setNodes(initialNodes)} className="px-2.5 py-1 rounded-[6px] text-[10px] text-[#666] hover:bg-[#f0f0f0]">↻ Reset</button>
            <button onClick={runFlow} disabled={flowRunning}
              className="px-3 py-1.5 rounded-[6px] text-[11px] font-bold bg-[#ff5a1f] text-white hover:bg-[#e04a10] disabled:opacity-50 flex items-center gap-1">
              {flowRunning?<><span className="w-2 h-2 rounded-full bg-white animate-pulse-slow"/>Corriendo</>:'▶ Ejecutar'}
            </button>
          </div>
        </div>

        <div className="flex-1 relative" ref={wrapper} tabIndex={0} onKeyDown={onKeyDown}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes} edges={edges}
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
              onConnect={onConnect} onDrop={onDrop} onDragOver={onDragOver}
              onNodeClick={onNodeClick} onInit={setRfi}
              nodeTypes={nodeTypes}
              fitView minZoom={0.1} maxZoom={3}
              snapToGrid snapGrid={[20,20]}
              attributionPosition="bottom-left"
              deleteKeyCode={['Delete','Backspace']}
              defaultEdgeOptions={{ type:'smoothstep', style:{ strokeWidth:2.5, stroke:'#888' }, markerEnd:{ type:MarkerType.ArrowClosed, color:'#888' } }}
            >
              <Controls showInteractive={false} className="!rounded-[8px]" />
              <MiniMap style={{ borderRadius:'8px', border:'1px solid rgba(0,0,0,0.08)' }} nodeColor={n=>n.data?.color||'#666'} maskColor="rgba(0,0,0,0.04)" />
              <Background variant="dots" gap={20} size={1.5} color="rgba(0,0,0,0.06)" />

              {showCfg==='kw' && (
                <div className="absolute top-3 left-3 z-20">
                  <KWP kwArr={keywordsArr} sched={sched} tz={tz}
                    onChange={({kwArr,sched:sk,tz:tz2})=>{if(kwArr!==undefined)setKeywordsArr(kwArr);if(sk)setSched(sk);if(tz2)setTz(tz2);}}
                    onClose={()=>setShowCfg('')} />
                </div>
              )}
              {showCfg&&showCfg!=='kw' && (
                <div className="absolute top-3 left-3 z-20">
                  <CHP type={nodes.find(n=>n.id===showCfg)?.data?.type||''}
                    config={nodeData[nodes.find(n=>n.id===showCfg)?.data?.type||'']||{}}
                    onChange={cfg=>setNodeData(p=>({...p,[nodes.find(n=>n.id===showCfg)?.data?.type||'']:cfg}))}
                    onClose={()=>setShowCfg('')} />
                </div>
              )}
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </div>

      {/* RIGHT: progress when running */}
      {flowRunning&&(
        <div className="w-[160px] flex-shrink-0 bg-white border-l p-3">
          <div className="text-[9px] font-bold uppercase text-[#888] mb-3">Progreso</div>
          {[{id:'trigger',icon:'⏰',label:'Schedule'},{id:'kw',icon:'🔑',label:'Keywords'},
            ...activeCh.map(t=>({id:`ch-${t}`,icon:CHANNEL_TYPES.find(c=>c.type===t)?.icon||'📡',label:CHANNEL_TYPES.find(c=>c.type===t)?.label||t})),
            {id:'engine',icon:'🔔',label:'Engine'},...(notifyChat?[{id:'chat',icon:'📢',label:'Chat'}]:[]),...(notifyEmail?[{id:'email',icon:'📧',label:'Email'}]:[]),
          ].map((s,i)=>(
            <div key={s.id} className={`flex items-center gap-1.5 p-1 rounded-[4px] mb-0.5 text-[10px] ${i===runIdx?'bg-[rgba(255,90,31,0.08)] text-[#ff5a1f] font-bold':i<runIdx?'text-[#10b981]':'text-[#999]'}`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] flex-shrink-0 ${i<runIdx?'bg-[#10b981] text-white':i===runIdx?'bg-[#ff5a1f] text-white animate-pulse':'bg-[#eee]'}`}>{i<runIdx?'✓':''}</span>
              {s.icon}{s.label}
            </div>
          ))}
        </div>
      )}

      {/* AI */}
      {showAI&&(
        <div className="w-[250px] flex-shrink-0 bg-white border-l flex flex-col">
          <div className="flex justify-between items-center px-3 py-2 border-b"><span className="text-[11px] font-bold">🤖 AI</span><button onClick={()=>setShowAI(false)} className="text-[#888]">✕</button></div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 text-[11px]">
            {aiM.length===0&&<div className="text-center py-4 text-[#888] space-y-1.5 text-[10px]">{['Que canales recomiendas?','Cuantos resultados?','Mejor frecuencia?'].map((q,i)=><button key={i} onClick={()=>setAiI(q)} className="block w-full text-left px-2 py-1 rounded-[4px] bg-[#f5f5f5] hover:bg-[rgba(255,90,31,0.08)]">{q}</button>)}</div>}
            {aiM.map((m,i)=><div key={i} className={`p-2 rounded-[6px] ${m.role==='user'?'bg-[rgba(255,90,31,0.08)] ml-2':'bg-[#f5f5f5] mr-2'}`}><div className="text-[7px] font-bold uppercase text-[#888] mb-0.5">{m.role==='user'?'Tu':'AI'}</div><div>{m.text}</div></div>)}
            {aiS&&<div className="text-center text-[#888] text-[10px]">Pensando...</div>}
          </div>
          <div className="p-3 border-t flex gap-1.5">
            <input value={aiI} onChange={e=>setAiI(e.target.value)} onKeyDown={e=>e.key==='Enter'&&askAI()} className="flex-1 px-2 py-1.5 rounded-[5px] border text-[11px] outline-none focus:border-[#8b63e7]" placeholder="Pregunta..."/>
            <button onClick={askAI} disabled={aiS} className="px-3 py-1.5 rounded-[5px] bg-[#8b63e7] text-white text-[10px] font-bold disabled:opacity-50">→</button>
          </div>
        </div>
      )}
    </div>
  );
}
