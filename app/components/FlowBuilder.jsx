'use client';
import { useCallback, useState } from 'react';
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
import Button from '../ui/Button';

const CHANNELS = {
  x: { label: 'X/Twitter', icon: '𝕏', color: '#1DA1F2' },
  reddit: { label: 'Reddit', icon: '🟠', color: '#FF4500' },
  news: { label: 'Noticias', icon: '📰', color: '#2D3748' },
  youtube: { label: 'YouTube', icon: '▶️', color: '#FF0000' },
  bluesky: { label: 'Bluesky', icon: '🦋', color: '#0085FF' },
  mastodon: { label: 'Mastodon', icon: '🐘', color: '#6364FF' },
  hacker_news: { label: 'Hacker News', icon: '🟧', color: '#FF6600' },
  google_alert: { label: 'Google Alerts', icon: '🔔', color: '#4285F4' },
  tiktok: { label: 'TikTok', icon: '🎵', color: '#000000' },
  site_monitor: { label: 'Sitios Web', icon: '🌐', color: '#6B7280' },
};

const initialNodes = [
  {
    id: 'keywords',
    type: 'input',
    position: { x: 250, y: 0 },
    data: { label: 'Keywords' },
    style: { background: '#ff5a1f', color: '#fff', border: 'none', borderRadius: '12px', padding: '12px 20px', fontSize: '13px', fontWeight: 700 },
  },
  {
    id: 'output',
    type: 'output',
    position: { x: 250, y: 500 },
    data: { label: 'Alert Engine → Google Chat' },
    style: { background: '#2b8e5c', color: '#fff', border: 'none', borderRadius: '12px', padding: '12px 20px', fontSize: '13px', fontWeight: 700 },
  },
];

const channelNodes = Object.entries(CHANNELS).map(([id, ch], i) => ({
  id,
  position: { x: (i % 3) * 220 + 100, y: Math.floor(i / 3) * 140 + 120 },
  data: { label: `${ch.icon} ${ch.label}` },
  style: { background: ch.color, color: '#fff', border: 'none', borderRadius: '12px', padding: '10px 16px', fontSize: '12px', fontWeight: 600 },
}));

const defaultEdges = [
  ...Object.keys(CHANNELS).map(id => ({ id: `kw-${id}`, source: 'keywords', target: id, animated: true, style: { stroke: '#988d84', strokeWidth: 2 } })),
  ...Object.keys(CHANNELS).map(id => ({ id: `${id}-out`, source: id, target: 'output', style: { stroke: '#988d84', strokeWidth: 1.5, strokeDasharray: '5 5' } })),
];

export default function FlowBuilder({ keywords = [], onRun }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([...initialNodes, ...channelNodes]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);
  const [flowRunning, setFlowRunning] = useState(false);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const runFlow = async () => {
    setFlowRunning(true);
    // Animate nodes sequentially
    for (const node of channelNodes) {
      setNodes(nds => nds.map(n => n.id === node.id ? { ...n, style: { ...n.style, opacity: 0.5 } } : n));
      await new Promise(r => setTimeout(r, 300));
      setNodes(nds => nds.map(n => n.id === node.id ? { ...n, style: { ...n.style, opacity: 1, boxShadow: '0 0 20px rgba(255,90,31,0.4)' } } : n));
      await new Promise(r => setTimeout(r, 500));
    }
    // Run actual job
    if (onRun) await onRun();
    setFlowRunning(false);
  };

  return (
    <div style={{ height: 'calc(100vh - 200px)', minHeight: 500 }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-syne text-[16px] text-[#201813]">Pipeline Visual</h3>
          <p className="text-[12px] text-[#988d84]">Arrastra para conectar canales</p>
        </div>
        <Button onClick={runFlow} disabled={flowRunning}>
          {flowRunning ? '⏳ Ejecutando...' : '▶ Ejecutar Pipeline'}
        </Button>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        attributionPosition="bottom-left"
      >
        <Controls />
        <MiniMap style={{ borderRadius: '12px' }} />
        <Background gap={16} size={1} color="rgba(32,24,19,0.06)" />
      </ReactFlow>
    </div>
  );
}
