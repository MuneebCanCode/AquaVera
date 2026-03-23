'use client';

import dynamic from 'next/dynamic';
import { LoadingSpinner } from './LoadingSpinner';

const chartLoader = () => import('recharts');

// Lazy-loaded recharts components — only loaded when first rendered
export const LazyLineChart = dynamic(() => chartLoader().then((m) => m.LineChart), {
  ssr: false,
  loading: () => <LoadingSpinner size="sm" label="Loading chart..." />,
});

export const LazyPieChart = dynamic(() => chartLoader().then((m) => m.PieChart), {
  ssr: false,
  loading: () => <LoadingSpinner size="sm" label="Loading chart..." />,
});

export const LazyBarChart = dynamic(() => chartLoader().then((m) => m.BarChart), {
  ssr: false,
  loading: () => <LoadingSpinner size="sm" label="Loading chart..." />,
});

// Re-export non-component recharts items that don't need lazy loading
export {
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Pie,
  Cell,
  Legend,
} from 'recharts';
