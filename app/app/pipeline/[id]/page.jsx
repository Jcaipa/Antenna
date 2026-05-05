'use client';
import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const FlowBuilder = dynamic(() => import('../../../components/FlowBuilder'), {
  ssr: false,
  loading: () => (
    <div className="h-screen flex items-center justify-center bg-[#f8f6f4] dark:bg-[#0f0b09]">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-[rgba(255,90,31,0.14)] border-t-[#ff5a1f] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[13px] text-[#988d84]">Cargando Pipeline Editor...</p>
      </div>
    </div>
  ),
});

export default function PipelinePage() {
  const params = useParams();
  const router = useRouter();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!params?.id) return;
    const fetchJob = async () => {
      try {
        const res = await fetch(`${API}/api/jobs/${params.id}`);
        if (!res.ok) throw new Error('Job no encontrado');
        const data = await res.json();
        setJob(data);
      } catch (e) {
        setError(e.message);
      }
      setLoading(false);
    };
    fetchJob();
  }, [params?.id]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#f8f6f4] dark:bg-[#0f0b09]">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-[rgba(255,90,31,0.14)] border-t-[#ff5a1f] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[13px] text-[#988d84]">Cargando Pipeline...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#f8f6f4] dark:bg-[#0f0b09]">
        <div className="text-center">
          <div className="text-5xl mb-4">🔗</div>
          <h2 className="font-syne text-xl text-[#201813] dark:text-[var(--ink)] mb-2">Pipeline no encontrado</h2>
          <p className="text-[13px] text-[#988d84] mb-6">{error || 'El job no existe o fue eliminado'}</p>
          <button onClick={() => router.push('/monitors')}
            className="px-5 py-2.5 rounded-[12px] bg-[#ff5a1f] text-white text-[13px] font-bold hover:shadow-lg transition-all">
            ← Volver a Monitores
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#f8f6f4] dark:bg-[#0f0b09]">
      <FlowBuilder
        job={job}
        onBack={() => router.push('/monitors')}
        onRun={async () => {
          const res = await fetch(`${API}/api/jobs/${job.id}/run`, { method: 'POST' });
          await res.body?.getReader()?.read();
        }}
        onSave={async (body) => {
          await fetch(`${API}/api/jobs/${job.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
        }}
      />
    </div>
  );
}
