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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const ALL_CHANNELS = {
  x: { label: 'X/Twitter', icon: '𝕏', color: '#1DA1F2', desc: 'Perfiles y tweets' },
  reddit: { label: 'Reddit', icon: '🟠', color: '#FF4500', desc: 'Posts y comentarios' },
  news: { label: 'Noticias', icon: '📰', color: '#2D3748', desc: 'Google News + NewsAPI' },
  youtube: { label: 'YouTube', icon: '▶️', color: '#FF0000', desc: 'Videos por keyword' },
  bluesky: { label: 'Bluesky', icon: '🦋', color: '#0085FF', desc: 'Posts públicos' },
  mastodon: { label: 'Mastodon', icon: '🐘', color: '#6364FF', desc: '3 instancias' },
  hacker_news: { label: 'Hacker News', icon: '🟧', color: '#FF6600', desc: 'Keyword search' },
  google_alert: { label: 'Google Alerts', icon: '🔔', color: '#4285F4', desc: 'RSS feeds' },
  google_trends: { label: 'Google Trends', icon: '📈', color: '#4285F4', desc: 'Interés por keyword' },
  google_serp: { label: 'Google SERP', icon: '🔍', color: '#34A853', desc: 'Rankings' },
  google_ads: { label: 'Google Ads', icon: '🎯', color: '#FBBC04', desc: 'Anuncios' },
  meta_ads: { label: 'Meta Ads', icon: '📱', color: '#1877F2', desc: 'FB + IG ads' },
  site_monitor: { label: 'Sitios Web', icon: '🌐', color: '#6B7280', desc: 'Screenshots + diff' },
  tiktok: { label: 'TikTok', icon: '🎵', color: '#000000', desc: 'Videos por keyword' },
};

function ChannelNode({ data }) {
  const { label, icon, color, active, desc } = data;
  return (
    <div
      className={`px-4 py-3 rounded-[14px] border-2 transition-all duration-200 cursor-pointer select-none ${
        active !== false ? 'shadow-md' : 'opacity-40'
      }`}
      style={{
        background: active !== false ? `${color}18` : '#f0f0f0',
        borderColor: active !== false ? color : '#ddd',
        minWidth: 160,
      }}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-xl">{icon}</span>
        <div>
          <div className="text-[13px] font-bold" style={{ color: active !== false ? color : '#999' }}>
            {label}
          </div>
          {desc && <div className="text-[10px] text-[#988d84] mt-0.5">{desc}</div>}
        </div>
        {active !== false && (
          <span className="ml-auto w-2 h-2 rounded-full" style={{ background: color }} />
        )}
      </div>
    </div>
  );
}

const nodeTypes = { channelNode: ChannelNode };

export default function FlowBuilder({ job, onRun, onSave, onBack }) {
  const [jobName, setJobName] = useState(job?.name || '');
  const [keywordsStr, setKeywordsStr] = useState(
    ((typeof job?.keywords === 'string' ? JSON.parse(job.keywords) : job?.keywords) || []).join(', ')
  );
  const [activeChannels, setActiveChannels] = useState(
    (typeof job?.channels === 'string' ? JSON.parse(job.channels) : job?.channels) || Object.keys(ALL_CHANNELS)
  );
  const [selectedNode, setSelectedNode] = useState(null);
  const [schedule, setSchedule] = useState(job?.schedule_minutes || 60);
  const [notifyChat, setNotifyChat] = useState(job?.notify_google_chat ?? true);
  const [notifyEmail, setNotifyEmail] = useState(job?.notify_email ?? false);
  const [rssUrls, setRssUrls] = useState(
    ((typeof job?.google_alerts_rss_urls === 'string' ? JSON.parse(job.google_alerts_rss_urls) : job?.google_alerts_rss_urls) || []).join(', ')
  );
  const [saving, setSaving] = useState(false);
  const [flowRunning, setFlowRunning] = useState(false);
  const reactFlowWrapper = useRef(null);

  // Nodes
  const initialNodes = useMemo(() => [
    {
      id: 'keywords-in',
      type: 'input',
      position: { x: 450, y: 0 },
      data: {
        label: keywordsStr || 'Keywords',
        keywords: keywordsStr,
      },
      style: {
        background: '#ff5a1f', color: '#fff', border: 'none',
        borderRadius: '14px', padding: '14px 24px', fontSize: '14px', fontWeight: 700,
        boxShadow: '0 8px 24px rgba(255,90,31,0.3)',
      },
    },
    {
      id: 'alert-engine',
      type: 'output',
      position: { x: 450, y: 600 },
      data: {
        label: 'Alert Engine → Google Chat',
        chat: notifyChat,
        email: notifyEmail,
      },
      style: {
        background: '#2b8e5c', color: '#fff', border: 'none',
        borderRadius: '14px', padding: '14px 24px', fontSize: '14px', fontWeight: 700,
        boxShadow: '0 8px 24px rgba(43,142,92,0.3)',
      },
    },
  ], [keywordsStr, notifyChat, notifyEmail]);

  const channelNodes = useMemo(() => {
    const all = Object.keys(ALL_CHANNELS);
    const cols = 4;
    return all.map((id, i) => ({
      id,
      type: 'channelNode',
      position: { x: (i % cols) * 220 + 60, y: Math.floor(i / cols) * 110 + 130 },
      data: {
        ...ALL_CHANNELS[id],
        active: activeChannels.includes(id),
      },
    }));
  }, [activeChannels]);

  const defaultEdges = useMemo(() => [
    ...Object.keys(ALL_CHANNELS).map(id => ({
      id: `kw-${id}`,
      source: 'keywords-in',
      target: id,
      animated: activeChannels.includes(id),
      style: {
        stroke: activeChannels.includes(id) ? '#ff5a1f' : '#ddd',
        strokeWidth: activeChannels.includes(id) ? 2.5 : 1,
        strokeDasharray: activeChannels.includes(id) ? 'none' : '5 5',
      },
      markerEnd: activeChannels.includes(id) ? { type: MarkerType.ArrowClosed, color: '#ff5a1f' } : undefined,
    })),
    ...Object.keys(ALL_CHANNELS).map(id => ({
      id: `${id}-out`,
      source: id,
      target: 'alert-engine',
      style: {
        stroke: activeChannels.includes(id) ? '#988d84' : '#ddd',
        strokeWidth: activeChannels.includes(id) ? 2 : 1,
        strokeDasharray: '5 5',
      },
    })),
  ], [activeChannels]);

  const [nodes, setNodes, onNodesChange] = useNodesState([...initialNodes, ...channelNodes]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);

  useEffect(() => {
    setNodes([...initialNodes, ...channelNodes]);
    setEdges(defaultEdges);
  }, [initialNodes, channelNodes, defaultEdges, setNodes, setEdges]);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node);
    if (node.id === 'keywords-in') {
      // Focus keywords
    } else if (node.id === 'alert-engine') {
      // Focus notifications
    } else {
      // Toggle channel
      setActiveChannels(prev =>
        prev.includes(node.id) ? prev.filter(c => c !== node.id) : [...prev, node.id]
      );
    }
  }, []);

  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  const toggleChannel = (id) => {
    setActiveChannels(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const runFlow = async () => {
    setFlowRunning(true);
    for (const id of activeChannels) {
      setNodes(nds => nds.map(n =>
        n.id === id ? { ...n, data: { ...n.data, running: true } } : n
      ));
      await new Promise(r => setTimeout(r, 300));
      setNodes(nds => nds.map(n =>
        n.id === id ? { ...n, data: { ...n.data, running: false, done: true } } : n
      ));
      await new Promise(r => setTimeout(r, 200));
    }
    if (onRun) await onRun();
    setFlowRunning(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        name: jobName,
        keywords: keywordsStr.split(',').map(k => k.trim()).filter(Boolean),
        channels: activeChannels,
        schedule_minutes: schedule,
        notify_google_chat: notifyChat,
        notify_email: notifyEmail,
        google_alerts_rss_urls: rssUrls.split(',').map(u => u.trim()).filter(Boolean),
      };
      if (onSave) await onSave(body);
    } catch (e) { alert('Error: ' + e.message); }
    setSaving(false);
  };

  return (
    <div className="flex h-[calc(100vh-100px)] gap-0 bg-[#f8f6f4] dark:bg-[#0f0b09] rounded-[20px] overflow-hidden border border-[rgba(32,24,19,0.08)]">
      {/* LEFT CONFIG PANEL */}
      <div className="w-[320px] flex-shrink-0 bg-white dark:bg-[#1a1512] border-r border-[rgba(32,24,19,0.08)] flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[rgba(32,24,19,0.06)]">
          <div className="flex items-center justify-between mb-3">
            <button onClick={onBack} className="text-[#988d84] hover:text-[#201813] text-sm">← Volver</button>
            <h2 className="font-syne text-[15px] text-[#201813] dark:text-[var(--ink)]">Pipeline Editor</h2>
          </div>
          <input
            value={jobName}
            onChange={e => setJobName(e.target.value)}
            className="w-full px-3 py-2 rounded-[10px] border border-[rgba(32,24,19,0.12)] text-[13px] font-bold text-[#201813] dark:bg-[#0f0b09] dark:text-[var(--ink)] outline-none focus:border-[#ff5a1f]"
            placeholder="Nombre del monitor"
          />
        </div>

        {/* Keywords */}
        <div className="px-5 py-4 border-b border-[rgba(32,24,19,0.06)]">
          <label className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#988d84] block mb-2">Keywords</label>
          <input
            value={keywordsStr}
            onChange={e => setKeywordsStr(e.target.value)}
            className="w-full px-3 py-2 rounded-[10px] border border-[rgba(32,24,19,0.12)] text-[12px] text-[#201813] dark:bg-[#0f0b09] dark:text-[var(--ink)] outline-none focus:border-[#ff5a1f]"
            placeholder="visa, inmigración, Estados Unidos"
          />
        </div>

        {/* Channels list */}
        <div className="flex-1 px-5 py-4 overflow-y-auto">
          <label className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#988d84] block mb-3">
            Canales ({activeChannels.length}/{Object.keys(ALL_CHANNELS).length})
          </label>
          <div className="space-y-1.5">
            {Object.entries(ALL_CHANNELS).map(([id, ch]) => (
              <button
                key={id}
                onClick={() => toggleChannel(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-left transition-all ${
                  activeChannels.includes(id)
                    ? 'bg-white dark:bg-[#0f0b09] shadow-sm border border-[rgba(32,24,19,0.08)]'
                    : 'opacity-40 hover:opacity-60'
                }`}
              >
                <span className="text-lg">{ch.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-bold" style={{ color: ch.color }}>{ch.label}</div>
                  <div className="text-[10px] text-[#988d84] truncate">{ch.desc}</div>
                </div>
                <div className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center transition-all ${
                  activeChannels.includes(id) ? 'border-[#2b8e5c] bg-[#2b8e5c]' : 'border-[#ddd]'
                }`}>
                  {activeChannels.includes(id) && <span className="text-white text-[10px]">✓</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Schedule & notifications */}
        <div className="px-5 py-4 border-t border-[rgba(32,24,19,0.06)] space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#988d84] block mb-1.5">Frecuencia</label>
            <select value={schedule} onChange={e => setSchedule(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-[10px] border border-[rgba(32,24,19,0.12)] text-[12px] text-[#201813] dark:bg-[#0f0b09] dark:text-[var(--ink)] outline-none bg-white">
              <option value={30}>Cada 30 min</option>
              <option value={60}>Cada hora</option>
              <option value={120}>Cada 2 horas</option>
              <option value={360}>Cada 6 horas</option>
              <option value={1440}>Cada día</option>
            </select>
          </div>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={notifyChat} onChange={e => setNotifyChat(e.target.checked)} className="accent-[#ff5a1f]" />
              <span className="text-[12px] text-[#201813] dark:text-[var(--ink)]">📢 Chat</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={notifyEmail} onChange={e => setNotifyEmail(e.target.checked)} className="accent-[#ff5a1f]" />
              <span className="text-[12px] text-[#201813] dark:text-[var(--ink)]">📧 Email</span>
            </label>
          </div>
          <input
            value={rssUrls}
            onChange={e => setRssUrls(e.target.value)}
            className="w-full px-3 py-2 rounded-[10px] border border-[rgba(32,24,19,0.12)] text-[11px] text-[#201813] dark:bg-[#0f0b09] dark:text-[var(--ink)] outline-none"
            placeholder="Google Alerts RSS URLs (opcional)"
          />
        </div>

        {/* Save button */}
        <div className="px-5 py-4 border-t border-[rgba(32,24,19,0.06)]">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 rounded-[12px] bg-gradient-to-r from-[#ff5a1f] to-[#ff7c2b] text-white text-[13px] font-bold hover:shadow-lg transition-all disabled:opacity-50"
          >
            {saving ? 'Guardando...' : '💾 Guardar Cambios'}
          </button>
        </div>
      </div>

      {/* CENTER: CANVAS */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-white dark:bg-[#1a1512] border-b border-[rgba(32,24,19,0.06)]">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#5f564f] dark:text-[var(--ink-2)]">
              <strong className="text-[#201813] dark:text-[var(--ink)]">{activeChannels.length}</strong> canales activos
            </span>
            <span className="w-px h-4 bg-[rgba(32,24,19,0.1)]" />
            <span className="text-[11px] text-[#988d84]">
              Keywords: <strong className="text-[#5f564f]">{keywordsStr || '—'}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setNodes([...initialNodes, ...channelNodes]); setEdges(defaultEdges); }}
              className="px-3 py-1.5 rounded-[8px] text-xs text-[#5f564f] hover:bg-[rgba(32,24,19,0.06)] transition-all"
            >
              🔄 Reset
            </button>
            <button
              onClick={runFlow}
              disabled={flowRunning}
              className="px-4 py-1.5 rounded-[8px] text-xs font-bold bg-[#ff5a1f] text-white hover:bg-[#e04a10] transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {flowRunning ? (
                <><span className="w-2 h-2 rounded-full bg-white animate-pulse-slow" /> Ejecutando...</>
              ) : '▶ Ejecutar Pipeline'}
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.3}
            maxZoom={2}
            attributionPosition="bottom-left"
          >
            <Controls className="!rounded-[10px] !shadow-sm" />
            <MiniMap
              style={{ borderRadius: '12px', border: '1px solid rgba(32,24,19,0.08)' }}
              nodeColor={(n) => n.data?.color || '#666'}
              maskColor="rgba(0,0,0,0.05)"
            />
            <Background gap={20} size={1} color="rgba(32,24,19,0.06)" />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
