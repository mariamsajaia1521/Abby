import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { calendarDate, formatDate } from '../dates';
import type { Weight } from '../types';

export function WeightChart({ weights }: { weights: Weight[] }) {
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
  const top = 22;
  const bottom = 142;
  const x = (day: number) => first.day === last.day ? (left + right) / 2 : left + (day - first.day) / (last.day - first.day) * (right - left);
  const y = (weight: number) => minimum === maximum ? (top + bottom) / 2 : bottom - (weight - minimum) / (maximum - minimum) * (bottom - top);
  const ticks = minimum === maximum ? [minimum] : [maximum, minimum];

  return <figure ref={containerRef} className="chart-wrap mb-5 min-w-0 overflow-hidden rounded-xl bg-[#fafafa] p-3 sm:p-4">
    <figcaption className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-semibold">წონის ცვლილება</span><span className="muted">{measurements.length} გაზომვა · კგ</span></figcaption>
    <svg className="block w-full" width={width} height="186" viewBox={`0 0 ${width} 186`} role="img" aria-labelledby={`${id}-title ${id}-description`}>
      <title id={`${id}-title`}>წონის ცვლილება შენახული გაზომვების მიხედვით</title>
      <desc id={`${id}-description`}>{measurements.length} გაზომვა. პირველი: {formatDate(first.date, { year: true })}, {first.weightKg} კგ. ბოლო: {formatDate(last.date, { year: true })}, {last.weightKg} კგ. მინიმუმი: {minimum} კგ, მაქსიმუმი: {maximum} კგ. ყველა გაზომვა ჩამოთვლილია გრაფიკის ქვემოთ.</desc>
      {ticks.map(value => <g key={value} aria-hidden="true"><line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="#e5e7eb" strokeDasharray="4 4"/><text x={left - 10} y={y(value) + 4} textAnchor="end" fill="#6b7280" fontSize="12">{value}</text></g>)}
      <line x1={left} x2={right} y1={bottom + 12} y2={bottom + 12} stroke="#e5e7eb" aria-hidden="true"/>
      <polyline points={measurements.map(item => `${x(item.day)},${y(item.weightKg)}`).join(' ')} fill="none" stroke="#7f56d9" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true"/>
      {measurements.map(item => <circle key={item.id} cx={x(item.day)} cy={y(item.weightKg)} r="4" fill="#7f56d9" stroke="#fff" strokeWidth="2"><title>{formatDate(item.date, { year: true })}: {item.weightKg} კგ</title></circle>)}
      <g aria-hidden="true" fill="#6b7280" fontSize="12">
        {first.day === last.day ? <text x={(left + right) / 2} y="178" textAnchor="middle">{formatDate(first.date, { short: true, year: true })}</text> : <><text x={left} y="178">{formatDate(first.date, { short: true, year: true })}</text><text x={right} y="178" textAnchor="end">{formatDate(last.date, { short: true, year: true })}</text></>}
      </g>
    </svg>
  </figure>;
}
