'use client';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Filler,
  BarElement
} from 'chart.js';
import { Doughnut, Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Filler,
  BarElement
);

const THEME = {
  brand: '#ff5a1f',
  success: '#2b8e5c',
  danger: '#df4d43',
  warning: '#ca8b16',
  blue: '#4b7bf2',
  plum: '#8b63e7',
  neutral: '#988d84'
};

export function SentimentDonut({ data }) {
const chartData = {
    labels: ['Positivo', 'Neutral', 'Negativo'],
    datasets: [{
      data: [
        data?.positive || data?.positivo || 0, 
        data?.neutral || 0, 
        data?.negative || data?.negativo || 0
      ],
      backgroundColor: [THEME.success, THEME.neutral, THEME.danger],
      borderWidth: 0,
      hoverOffset: 4
    }]
  };

  const options = {
    cutout: '75%',
    plugins: {
      legend: { display: false }
    },
    maintainAspectRatio: false
  };

  return (
    <div className="chart-wrap chart-h200">
      <Doughnut data={chartData} options={options} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
        <strong style={{ display: 'block', fontSize: 24, fontFamily: 'Syne' }}>
          {Math.round(((data?.positive || data?.positivo || 0) / ((data?.positive || data?.positivo || 0) + (data?.neutral || 0) + (data?.negative || data?.negativo || 1))) * 100)}%
        </strong>
        <span style={{ fontSize: 9, textTransform: 'uppercase', fontWeight: 700, color: 'var(--ink-3)' }}>Net Pos.</span>
      </div>
    </div>
  );
}

export function TrendLine({ data, label }) {
  const chartData = {
    labels: data?.labels || [],
    datasets: [{
      label,
      data: data?.values || [],
      fill: true,
      borderColor: THEME.brand,
      backgroundColor: 'rgba(255, 90, 31, 0.1)',
      tension: 0.4,
      pointRadius: 0
    }]
  };

  const options = {
    plugins: { legend: { display: false } },
    scales: {
      x: { display: false },
      y: { display: false }
    },
    maintainAspectRatio: false
  };

  return (
    <div className="chart-wrap chart-h200">
      <Line data={chartData} options={options} />
    </div>
  );
}

export function KeywordBar({ data }) {
  const chartData = {
    labels: data.map(i => i.keyword || i.word),
    datasets: [{
      label: 'Menciones',
      data: data.map(i => i.count),
      backgroundColor: THEME.brand,
      borderRadius: 6
    }]
  };

  const options = {
    indexAxis: 'y',
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { display: false } }
    },
    maintainAspectRatio: false
  };

  return (
    <div className="chart-wrap chart-h340">
      <Bar data={chartData} options={options} />
    </div>
  );
}
