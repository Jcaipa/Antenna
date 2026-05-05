'use client';
import { useCallback, useMemo, useState, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Button from './ui/Button';

const ALL_CHANNELS = {
  x: { label: 'X/Twitter', icon: '𝕏', color: '#1DA1F2' },
  reddit: { label: 'Reddit', icon: '🟠', color: '#FF4500' },
  news: { label: 'Noticias', icon: '📰', color: '#2D3748' },
  youtube: { label: 'YouTube', icon: '▶️', color: '#FF0000' },
  bluesky: { label: 'Bluesky', icon: '🦋', color: '#0085FF' },
  mastodon: { label: 'Mastodon', icon: '🐘', color: '#6364FF' },
  hacker_news: { label: 'Hacker News', icon: '🟧', color: '#FF6600' },
  google_alert: { label: 'Google Alerts', icon: '🔔', color: '#4285F4' },
  google_trends: { label: 'Google Trends', icon: '📈', color: '#4285F4' },
  google_serp: { label: 'Google SERP', icon: '🔍', color: '#34A853' },
  google_ads: { label: 'Google Ads', icon: '🎯', color: '#FBBC04' },
  meta_ads: { label: 'Meta Ads', icon: '📱', color: '#1877F2' },
  site_monitor: { label: 'Sitios Web', icon: '🌐', color: '#6B7280' },
  tiktok: { label: 'TikTok', icon: '🎵', color: '#000000' },
};

export default function FlowBuilder({ keywords = [], channels = [], onRun }) {
  const activeChannels = useMemo(() => {
    if (!channels || channels.length === 0) return Object.keys(ALL_CHANNELS);
    return channels.filter(c => ALL_CHANNELS[c]);
  }, [channels]);

  const sortedChannels = useMemo(() => {
    const cols = Math.min(3, Math.max(2, Math.ceil(activeChannels.length / 3)));
    return activeChannels.map((id, i) => ({
      id,
      position: { x: (i % cols) * 220 + 100, y: Math.floor(i / cols) * 120 + 120 },
    }));
  }, [activeChannels]);

  const initialNodes = useMemo(() => [
    {
      id: 'keywords',
      type: 'input',
      position: { x: 220, y: 0 },
      data: { label: keywords.length > 0 ? keywords.join(', ') : 'Keywords' },
      style: { background: '#ff5a1f', color: '#fff', border: 'none', borderRadius: '12px', padding: '10px 18px', fontSize: '12px', fontWeight: 700 },
    },
    {
      id: 'output',
      type: 'output',
      position: { x: 220, y: 500 },
      data: { label: 'Alert Engine → Google Chat' },
      style: { background: '#2b8e5c', color: '#fff', border: 'none', borderRadius: '12px', padding: '10px 18px', fontSize: '12px', fontWeight: 700 },
    },
  ], [keywords]);

  const channelNodes = useMemo(() => sortedChannels.map(({ id, position }) => ({
    id,
    position,
    data: { label: `${ALL_CHANNELS[id].icon} ${ALL_CHANNELS[id].label}` },
    style: { background: ALL_CHANNELS[id].color, color: '#fff', border: 'none', borderRadius: '12px', padding: '8px 14px', fontSize: '11px', fontWeight: 600 },
  })), [sortedChannels]);

  const defaultEdges = useMemo(() => [
    ...activeChannels.map(id => ({ id: `kw-${id}`, source: 'keywords', target: id, animated: true, style: { stroke: '#ff5a1f', strokeWidth: 2 } })),
    ...activeChannels.map(id => ({ id: `${id}-out`, source: id, target: 'output', style: { stroke: '#988d84', strokeWidth: 1.5, strokeDasharray: '5 5' } })),
  ], [activeChannels]);

  const [nodes, setNodes, onNodesChange] = useNodesState([...initialNodes, ...channelNodes]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);
  const [flowRunning, setFlowRunning] = useState(false);

  useEffect(() => {
    setNodes([...initialNodes, ...channelNodes]);
    setEdges(defaultEdges);
  }, [initialNodes, channelNodes, defaultEdges, setNodes, setEdges]);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const runFlow = async () => {
    setFlowRunning(true);
    for (const node of channelNodes) {
      setNodes(nds => nds.map(n => n.id === node.id ? { ...n, style: { ...n.style, opacity: 0.4 } } : n));
      await new Promise(r => setTimeout(r, 200));
      setNodes(nds => nds.map(n => {
        if (n.id === node.id) return { ...n, style: { ...n.style, opacity: 1, boxShadow: '0 0 20px rgba(255,90,31,0.4)' } };
        return n;
      }));
      await new Promise(r => setTimeout(r, 400));
    }
    if (onRun) await onRun();
    setFlowRunning(false);
  };

  return (
    <div className="w-full border border-[rgba(32,24,19,0.08)] rounded-[20px] overflow-hidden bg-white dark:bg-[#1a1512]">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(32,24,19,0.06)]">
        <div>
          <h3 className="font-syne text-[14px] text-[#201813] dark:text-[var(--ink)]">Pipeline Visual</h3>
          <p className="text-[11px] text-[#988d84]">{activeChannels.length} canales activos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setNodes([...initialNodes, ...channelNodes]); setEdges(defaultEdges); }}
            className="px-3 py-1.5 rounded-[8px] text-xs text-[#5f564f] hover:bg-[rgba(32,24,19,0.06)] transition-all">
            🔄 Restaurar
          </button>
          <Button onClick={runFlow} disabled={flowRunning} size="sm">
            {flowRunning ? '⏳ Ejecutando...' : '▶ Ejecutar Pipeline'}
          </Button>
        </div>
      </div>
      <div style={{ height: 400 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          attributionPosition="bottom-left"
        >
          <Controls showInteractive={false} />
          <MiniMap style={{ borderRadius: '8px' }} />
          <Background gap={16} size={1} color="rgba(32,24,19,0.06)" />
        </ReactFlow>
      </div>
    </div>
  );
}
