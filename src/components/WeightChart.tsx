import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { calendarDate, formatDate } from '../dates';
import type { Weight } from '../types';

export function WeightChart({ weights, embedded = false }: { weights: Weight[]; embedded?: boolean }) {
  const id = useId();
  const containerRef = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(560);
  const measurements = useMemo(() => weights.flatMap(item => {
    const date = calendarDate(item.date);
    return date && Number.isFinite(item.weightKg) && item.weightKg > 0
      ? [{ ...item, day: Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) }]
      : [];
  }).sort((a, b) => a.day - b.day || a.timestamp - b.timestamp), [weights]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      const measuredWidth = entries[0]?.contentRect.width;
      if (measuredWidth) setWidth(Math.max(240, Math.round(measuredWidth)));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  if (measurements.length < 2) return null;
  const first = measurements[0];
  const last = measurements[measurements.length - 1];
  const values = measurements.map(item => item.weightKg);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const left = 62;
  const right = width - 16;
  const top = 18;
  const bottom = 168;
  const padding = maximum === minimum ? Math.max(maximum * .05, .25) : Math.max((maximum - minimum) * .25, .05);
  const domainMin = Math.max(0, minimum - padding);
  const domainMax = maximum + padding;
  const x = (day: number) => first.day === last.day ? (left + right) / 2 : left + (day - first.day) / (last.day - first.day) * (right - left);
  const y = (weight: number) => bottom - (weight - domainMin) / (domainMax - domainMin) * (bottom - top);
  const ticks = Array.from({ length: 4 }, (_, index) => domainMax - (domainMax - domainMin) * index / 3);
  const tickFormat = new Intl.NumberFormat('ka-GE', { maximumFractionDigits: 2 });
  const area = `M ${x(first.day)},${bottom} L ${measurements.map(item => `${x(item.day)},${y(item.weightKg)}`).join(' L ')} L ${x(last.day)},${bottom} Z`;

  return <figure ref={containerRef} className={`chart-wrap min-w-0 overflow-hidden${embedded ? ' chart-embedded' : ' mb-5 rounded-xl p-3 sm:p-4'}`}>
    {!embedded && <figcaption className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-semibold">წონის ცვლილება</span><span className="muted">{measurements.length} გაზომვა · კგ</span></figcaption>}
    <svg className="block w-full" width={width} height="210" viewBox={`0 0 ${width} 210`} role="img" aria-labelledby={`${id}-title ${id}-description`}>
      <title id={`${id}-title`}>წონის ცვლილება შენახული გაზომვების მიხედვით</title>
      <desc id={`${id}-description`}>{measurements.length} გაზომვა. პირველი: {formatDate(first.date, { year: true })}, {first.weightKg} კგ. ბოლო: {formatDate(last.date, { year: true })}, {last.weightKg} კგ. მინიმუმი: {minimum} კგ, მაქსიმუმი: {maximum} კგ.</desc>
      <defs><linearGradient id={`${id}-area`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#5661d5" stopOpacity=".1"/><stop offset="100%" stopColor="#5661d5" stopOpacity="0"/></linearGradient></defs>
      {ticks.map(value => <g key={value} aria-hidden="true"><line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="#edf0f4" strokeDasharray="3 5"/><text x={left - 12} y={y(value) + 4} textAnchor="end" fill="#7d8797" fontSize="11">{tickFormat.format(value)}</text></g>)}
      <path d={area} fill={`url(#${id}-area)`} aria-hidden="true"/>
      <polyline points={measurements.map(item => `${x(item.day)},${y(item.weightKg)}`).join(' ')} fill="none" stroke="#5661d5" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true"/>
      {measurements.map(item => <circle key={item.id} cx={x(item.day)} cy={y(item.weightKg)} r="3.5" fill="#5661d5" stroke="#fff" strokeWidth="2"><title>{formatDate(item.date, { year: true })}: {item.weightKg} კგ</title></circle>)}
      <g aria-hidden="true" fill="#6b7280" fontSize="12">
        {first.day === last.day ? <text x={(left + right) / 2} y="201" textAnchor="middle">{formatDate(first.date, { short: true, year: true })}</text> : <><text x={left} y="201">{formatDate(first.date, { short: true, year: true })}</text><text x={right} y="201" textAnchor="end">{formatDate(last.date, { short: true, year: true })}</text></>}
      </g>
    </svg>
  </figure>;
}
