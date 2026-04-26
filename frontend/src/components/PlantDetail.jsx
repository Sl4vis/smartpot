import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Droplets,
  Thermometer,
  Sun,
  Wind,
  Brain,
  Droplet,
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  Trash2,
  PencilLine,
  Clock3,
  TrendingDown,
  Activity
} from 'lucide-react';
import {
  getPlant,
  getSensorHistory,
  getLatestReading,
  analyzeHealth,
  waterPlant,
  getWateringHistory,
  getAnalysisHistory,
  deletePlant
} from '../services/api';
import GaugeRing from './GaugeRing';
import PlantEditModal from './PlantEditModal';
import { getDeviceStatus, isDeviceOnline, normalizeDeviceStatus } from '../utils/deviceStatus';
import { getPlantEmoji } from '../utils/plantEmoji';

const DEMO_PLANT = {
  id: 'demo-1',
  name: 'Monstera',
  species: 'Monstera deliciosa',
  device_id: 'esp32-001',
  location: 'Obývačka',
  min_soil_moisture: 40,
  max_soil_moisture: 70,
  min_temperature: 18,
  max_temperature: 28,
  min_light: 300
};

const LIVE_REFRESH_MS = 20000;
const MAX_CHART_HOURS = 48;
const MIN_ZOOM_RANGE_MS = 2 * 60 * 1000;
const OFFLINE_GAP_MS = 3 * 60 * 1000;
const CHART_ANIMATION_MS = 520;
const CHART_LEFT_PAD = 52;
const CHART_RIGHT_PAD = 16;

function demoHistory() {
  const now = Date.now();
  return Array.from({ length: 48 }, (_, i) => ({
    created_at: new Date(now - (47 - i) * 30 * 60000).toISOString(),
    soil_moisture: 45 + Math.sin(i / 6) * 15 + (Math.random() - 0.5) * 4,
    temperature: 21 + Math.sin(i / 10) * 3 + (Math.random() - 0.5) * 0.8,
    humidity: 55 + Math.cos(i / 8) * 10 + (Math.random() - 0.5) * 2,
    light_lux: Math.max(0, 600 + Math.sin((i - 12) / 7.6) * 500 + (Math.random() - 0.5) * 80)
  }));
}

const METRICS = [
  { key: 'soil_moisture', label: 'Vlhkosť pôdy', icon: Droplets, color: '#3b82f6', unit: '%' },
  { key: 'temperature', label: 'Teplota', icon: Thermometer, color: '#f97316', unit: '°C' },
  { key: 'humidity', label: 'Vlhkosť vzduchu', icon: Wind, color: '#8b5cf6', unit: '%' },
  { key: 'light_lux', label: 'Svetlo', icon: Sun, color: '#f59e0b', unit: ' lux' }
];

const METRIC_DEFAULT_DOMAINS = {
  soil_moisture: [0, 100],
  temperature: [0, 40],
  humidity: [0, 100],
  light_lux: [0, 2000]
};

function formatTooltipLabel(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('sk', { day: 'numeric', month: 'numeric', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('sk', { hour: '2-digit', minute: '2-digit' });
}

function formatUpdatedAt(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return `${d.toLocaleDateString('sk', { day: 'numeric', month: 'numeric', year: 'numeric' })} - ${d.toLocaleTimeString('sk', {
    hour: '2-digit',
    minute: '2-digit'
  })}`;
}

function formatTickTime(ts, showDate) {
  const d = new Date(ts);
  if (showDate) {
    return d.toLocaleDateString('sk', { day: 'numeric', month: 'numeric' }) + '\n' +
      d.toLocaleTimeString('sk', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleTimeString('sk', { hour: '2-digit', minute: '2-digit' });
}

function shouldShowDateOnTicks(startTs, endTs) {
  const start = new Date(startTs);
  const end = new Date(endTs);
  return start.getFullYear() !== end.getFullYear() ||
    start.getMonth() !== end.getMonth() ||
    start.getDate() !== end.getDate();
}

function generateTicks(start, end) {
  const count = 6;
  const step = (end - start) / count;
  const ticks = [];
  for (let i = 0; i <= count; i++) {
    ticks.push(Math.round(start + i * step));
  }
  return ticks;
}

function generateNumericTicks(start, end, count = 5) {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
  if (start === end) return [start];

  const step = (end - start) / count;
  return Array.from({ length: count + 1 }, (_, i) => Math.round((start + step * i) * 10) / 10);
}

const PRO_CHART_WIDTH = 1000;
const PRO_CHART_HEIGHT = 270;
const PRO_CHART_TOP = 12;
const PRO_CHART_BOTTOM = 42;
const PRO_CHART_LEFT = CHART_LEFT_PAD;
const PRO_CHART_RIGHT = CHART_RIGHT_PAD;
const PRO_CHART_PLOT_WIDTH = PRO_CHART_WIDTH - PRO_CHART_LEFT - PRO_CHART_RIGHT;
const PRO_CHART_PLOT_HEIGHT = PRO_CHART_HEIGHT - PRO_CHART_TOP - PRO_CHART_BOTTOM;

function buildSmoothPath(points) {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return d;
}

function clampChartValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function isSamePair(a, b) {
  return Array.isArray(a) && Array.isArray(b) &&
    a.length === 2 && b.length === 2 &&
    Math.abs(a[0] - b[0]) < 0.5 &&
    Math.abs(a[1] - b[1]) < 0.5;
}

function lerpPair(from, to, t) {
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t
  ];
}

function useAnimatedPair(targetPair, duration = CHART_ANIMATION_MS) {
  const [animatedPair, setAnimatedPair] = useState(targetPair);
  const frameRef = useRef(null);
  const currentRef = useRef(targetPair);

  useEffect(() => {
    if (!Array.isArray(targetPair) || targetPair.length !== 2) return undefined;

    if (!Array.isArray(currentRef.current) || currentRef.current.length !== 2) {
      currentRef.current = targetPair;
      setAnimatedPair(targetPair);
      return undefined;
    }

    if (isSamePair(currentRef.current, targetPair)) {
      currentRef.current = targetPair;
      setAnimatedPair(targetPair);
      return undefined;
    }

    const from = currentRef.current;
    const to = targetPair;
    const startedAt = performance.now();

    if (frameRef.current) cancelAnimationFrame(frameRef.current);

    const tick = (now) => {
      const rawProgress = Math.min(1, (now - startedAt) / duration);
      const eased = easeOutCubic(rawProgress);
      const next = lerpPair(from, to, eased);

      currentRef.current = next;
      setAnimatedPair(next);

      if (rawProgress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        currentRef.current = to;
        setAnimatedPair(to);
        frameRef.current = null;
      }
    };

    // requestAnimationFrame beží podľa refresh-rate monitora, takže na 120 Hz paneli renderuje až 120 fps.
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [targetPair?.[0], targetPair?.[1], duration]);

  return animatedPair;
}

function ProfessionalMetricChart({
  data,
  metric,
  metricConfig,
  domain,
  yDomain,
  ticks,
  yTicks,
  showDateOnTicks
}) {
  const [hover, setHover] = useState(null);
  const chartId = useMemo(() => `pro-chart-${metric}`, [metric]);
  const animatedDomain = useAnimatedPair(domain, CHART_ANIMATION_MS);
  const animatedYDomain = useAnimatedPair(yDomain, CHART_ANIMATION_MS);
  const visualDomain = Array.isArray(animatedDomain) && animatedDomain.length === 2 ? animatedDomain : domain;
  const visualYDomain = Array.isArray(animatedYDomain) && animatedYDomain.length === 2 ? animatedYDomain : yDomain;

  const prepared = useMemo(() => {
    const points = (Array.isArray(data) ? data : [])
      .map(point => ({
        ...point,
        ts: typeof point.ts === 'number' ? point.ts : new Date(point.created_at).getTime(),
        value: point?.[metric]
      }))
      .filter(point => Number.isFinite(point.ts) && typeof point.value === 'number' && Number.isFinite(point.value))
      .sort((a, b) => a.ts - b.ts);

    if (!points.length || !domain?.length || !Number.isFinite(domain[0]) || !Number.isFinite(domain[1])) {
      return {
        points: [],
        visiblePoints: [],
        path: '',
        areaPath: '',
        offlineRanges: [],
        transform: 'translate(0px, 0px) scale(1, 1)'
      };
    }

    const domainStart = visualDomain[0];
    const domainEnd = visualDomain[1];
    const domainRange = Math.max(1, domainEnd - domainStart);
    const latestPointTs = points[points.length - 1].ts;
    const bufferEnd = Math.max(latestPointTs, domainEnd);
    const bufferStart = bufferEnd - MAX_CHART_HOURS * 60 * 60 * 1000;
    const bufferRange = Math.max(1, bufferEnd - bufferStart);
    const yMin = visualYDomain[0];
    const yMax = visualYDomain[1];
    const yRange = Math.max(0.0001, yMax - yMin);

    const plottedPoints = points
      .filter(point => point.ts >= bufferStart && point.ts <= bufferEnd)
      .map(point => {
        const x = ((point.ts - bufferStart) / bufferRange) * PRO_CHART_PLOT_WIDTH;
        const safeValue = clampChartValue(point.value, yMin, yMax);
        const y = PRO_CHART_TOP + (1 - ((safeValue - yMin) / yRange)) * PRO_CHART_PLOT_HEIGHT;
        return { ...point, x, y };
      });

    const visiblePoints = plottedPoints.filter(point => point.ts >= domainStart && point.ts <= domainEnd);
    const offlineRanges = [];
    const plottedByTime = plottedPoints.slice().sort((a, b) => a.ts - b.ts);

    for (let i = 1; i < plottedByTime.length; i += 1) {
      const previous = plottedByTime[i - 1];
      const current = plottedByTime[i];
      const offlineStart = previous.ts + OFFLINE_GAP_MS;
      const offlineEnd = current.ts;

      if (offlineEnd > offlineStart && offlineEnd >= domainStart && offlineStart <= domainEnd) {
        const x1 = ((Math.max(offlineStart, bufferStart) - bufferStart) / bufferRange) * PRO_CHART_PLOT_WIDTH;
        const x2 = ((Math.min(offlineEnd, bufferEnd) - bufferStart) / bufferRange) * PRO_CHART_PLOT_WIDTH;
        if (x2 > x1) offlineRanges.push({ x: x1, width: x2 - x1 });
      }
    }

    const lastKnownPoint = plottedByTime[plottedByTime.length - 1];
    if (lastKnownPoint) {
      const offlineStart = lastKnownPoint.ts + OFFLINE_GAP_MS;
      const offlineEnd = domainEnd;

      if (offlineEnd > offlineStart) {
        const x1 = ((Math.max(offlineStart, bufferStart) - bufferStart) / bufferRange) * PRO_CHART_PLOT_WIDTH;
        const x2 = ((Math.min(offlineEnd, bufferEnd) - bufferStart) / bufferRange) * PRO_CHART_PLOT_WIDTH;
        if (x2 > x1) offlineRanges.push({ x: x1, width: x2 - x1 });
      }
    }

    const linePath = buildSmoothPath(plottedPoints);
    const firstPoint = plottedPoints[0];
    const lastPoint = plottedPoints[plottedPoints.length - 1];
    const baseline = PRO_CHART_TOP + PRO_CHART_PLOT_HEIGHT;
    const areaPath = linePath && firstPoint && lastPoint
      ? `${linePath} L ${lastPoint.x} ${baseline} L ${firstPoint.x} ${baseline} Z`
      : '';

    const selectedStartX = ((domainStart - bufferStart) / bufferRange) * PRO_CHART_PLOT_WIDTH;
    const scaleX = bufferRange / domainRange;
    const translateX = PRO_CHART_LEFT - selectedStartX * scaleX;

    return {
      points: plottedPoints,
      visiblePoints,
      path: linePath,
      areaPath,
      offlineRanges,
      transform: `translate(${translateX}px, 0px) scale(${scaleX}, 1)`
    };
  }, [data, visualDomain, metric, visualYDomain]);

  const handlePointerMove = useCallback((event) => {
    if (!prepared.visiblePoints.length || !visualDomain?.length) {
      setHover(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const plotLeftPx = (PRO_CHART_LEFT / PRO_CHART_WIDTH) * rect.width;
    const plotWidthPx = (PRO_CHART_PLOT_WIDTH / PRO_CHART_WIDTH) * rect.width;
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left - plotLeftPx) / Math.max(1, plotWidthPx)));
    const targetTs = visualDomain[0] + ratio * (visualDomain[1] - visualDomain[0]);

    const nearest = prepared.visiblePoints.reduce((best, point) => {
      if (!best) return point;
      return Math.abs(point.ts - targetTs) < Math.abs(best.ts - targetTs) ? point : best;
    }, null);

    if (!nearest) {
      setHover(null);
      return;
    }

    const x = PRO_CHART_LEFT + ratio * PRO_CHART_PLOT_WIDTH;
    setHover({
      point: nearest,
      x,
      y: nearest.y
    });
  }, [visualDomain, prepared.visiblePoints]);

  const handlePointerLeave = useCallback(() => setHover(null), []);
  const safeTicks = Array.isArray(ticks) && ticks.length > 0 ? ticks : [];
  const safeYTicks = Array.isArray(yTicks) && yTicks.length > 0 ? yTicks : [];

  return (
    <div className="relative h-[270px] select-none">
      <svg
        viewBox={`0 0 ${PRO_CHART_WIDTH} ${PRO_CHART_HEIGHT}`}
        className="h-full w-full overflow-visible"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <defs>
          <clipPath id={`${chartId}-clip`}>
            <rect x={PRO_CHART_LEFT} y={PRO_CHART_TOP} width={PRO_CHART_PLOT_WIDTH} height={PRO_CHART_PLOT_HEIGHT} rx="6" />
          </clipPath>
          <linearGradient id={`${chartId}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={metricConfig.color} stopOpacity="0.20" />
            <stop offset="55%" stopColor={metricConfig.color} stopOpacity="0.07" />
            <stop offset="100%" stopColor={metricConfig.color} stopOpacity="0" />
          </linearGradient>
          <filter id={`${chartId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect
          x={PRO_CHART_LEFT}
          y={PRO_CHART_TOP}
          width={PRO_CHART_PLOT_WIDTH}
          height={PRO_CHART_PLOT_HEIGHT}
          fill="transparent"
        />

        {safeYTicks.map((value) => {
          const ratio = (value - visualYDomain[0]) / Math.max(0.0001, visualYDomain[1] - visualYDomain[0]);
          const y = PRO_CHART_TOP + (1 - ratio) * PRO_CHART_PLOT_HEIGHT;
          return (
            <g key={`y-${value}`}>
              <line
                x1={PRO_CHART_LEFT}
                x2={PRO_CHART_LEFT + PRO_CHART_PLOT_WIDTH}
                y1={y}
                y2={y}
                className="stroke-sage-200/70 dark:stroke-green-500/10"
                strokeDasharray="4 6"
              />
              <text
                x={PRO_CHART_LEFT - 12}
                y={y + 4}
                textAnchor="end"
                className="fill-sage-500 dark:fill-green-700"
                fontSize="12"
                fontWeight="500"
              >
                {Number.isInteger(value) ? value : value.toFixed(1)}
              </text>
            </g>
          );
        })}

        <line
          x1={PRO_CHART_LEFT}
          x2={PRO_CHART_LEFT + PRO_CHART_PLOT_WIDTH}
          y1={PRO_CHART_TOP + PRO_CHART_PLOT_HEIGHT}
          y2={PRO_CHART_TOP + PRO_CHART_PLOT_HEIGHT}
          className="stroke-sage-300 dark:stroke-green-500/30"
          strokeWidth="1"
        />

        <g clipPath={`url(#${chartId}-clip)`}>
          <g
            style={{
              transform: prepared.transform,
              transformOrigin: '0px 0px',
              transformBox: 'view-box',
              transition: 'none',
              willChange: 'transform'
            }}
          >
            {prepared.offlineRanges.map((range, index) => (
              <g key={`offline-${index}`}>
                <rect
                  x={range.x}
                  y={PRO_CHART_TOP}
                  width={range.width}
                  height={PRO_CHART_PLOT_HEIGHT}
                  className="fill-red-400/10 dark:fill-red-500/10"
                />
                <line
                  x1={range.x}
                  x2={range.x}
                  y1={PRO_CHART_TOP}
                  y2={PRO_CHART_TOP + PRO_CHART_PLOT_HEIGHT}
                  className="stroke-red-400/40 dark:stroke-red-500/30"
                  strokeDasharray="5 6"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ))}
            {prepared.areaPath && (
              <path
                d={prepared.areaPath}
                fill={`url(#${chartId}-fill)`}
                vectorEffect="non-scaling-stroke"
                style={{ transition: 'opacity 220ms ease' }}
              />
            )}
            {prepared.path && (
              <path
                d={prepared.path}
                fill="none"
                stroke={metricConfig.color}
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                filter={`url(#${chartId}-glow)`}
                style={{ transition: 'opacity 220ms ease' }}
              />
            )}
          </g>
        </g>

        {hover?.point && (
          <g pointerEvents="none">
            <line
              x1={hover.x}
              x2={hover.x}
              y1={PRO_CHART_TOP}
              y2={PRO_CHART_TOP + PRO_CHART_PLOT_HEIGHT}
              stroke={metricConfig.color}
              strokeOpacity="0.45"
              strokeDasharray="4 5"
            />
            <circle
              cx={hover.x}
              cy={hover.y}
              r="4.5"
              fill={metricConfig.color}
              stroke="white"
              strokeWidth="2"
            />
          </g>
        )}

        {safeTicks.map((tick) => {
          const ratio = (tick - visualDomain[0]) / Math.max(1, visualDomain[1] - visualDomain[0]);
          const x = PRO_CHART_LEFT + ratio * PRO_CHART_PLOT_WIDTH;
          const label = formatTickTime(tick, showDateOnTicks).split('\n');
          return (
            <text
              key={`x-${tick}`}
              x={x}
              y={PRO_CHART_TOP + PRO_CHART_PLOT_HEIGHT + 22}
              textAnchor={ratio < 0.05 ? 'start' : ratio > 0.95 ? 'end' : 'middle'}
              className="fill-sage-500 dark:fill-green-700"
              fontSize="12"
              fontWeight="500"
            >
              {label.map((part, index) => (
                <tspan key={`${tick}-${index}`} x={x} dy={index === 0 ? 0 : 14}>{part}</tspan>
              ))}
            </text>
          );
        })}
      </svg>

      {hover?.point && (
        <div
          className="pointer-events-none absolute z-20 rounded-xl border border-white/70 bg-white/95 px-3 py-2 text-xs shadow-xl shadow-black/10 backdrop-blur-md dark:border-green-500/20 dark:bg-[#07120d]/95 dark:shadow-black/30"
          style={{
            left: `${Math.min(88, Math.max(8, (hover.x / PRO_CHART_WIDTH) * 100))}%`,
            top: `${Math.min(72, Math.max(8, (hover.y / PRO_CHART_HEIGHT) * 100))}%`,
            transform: 'translate(-50%, -110%)'
          }}
        >
          <div className="mb-1 whitespace-nowrap font-semibold text-green-900 dark:text-green-100">
            {formatTooltipLabel(hover.point.ts)}
          </div>
          <div className="whitespace-nowrap text-sage-600 dark:text-green-500">
            {Math.round(hover.point.value * 10) / 10}{metricConfig.unit}
          </div>
        </div>
      )}
    </div>
  );
}


function getChartWidth(rect) {
  return Math.max(1, rect.width - CHART_LEFT_PAD - CHART_RIGHT_PAD);
}

function getRelativeChartX(clientX, rect) {
  const chartWidth = getChartWidth(rect);
  return Math.max(0, Math.min(1, (clientX - rect.left - CHART_LEFT_PAD) / chartWidth));
}

function getTouchDistance(touchA, touchB) {
  const dx = touchA.clientX - touchB.clientX;
  const dy = touchA.clientY - touchB.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function clampZoomDomain(domain, fullDomain) {
  let { x1, x2 } = domain;

  if (x2 <= x1) {
    x2 = x1 + MIN_ZOOM_RANGE_MS;
  }

  if (x1 < fullDomain.x1) {
    x2 += fullDomain.x1 - x1;
    x1 = fullDomain.x1;
  }

  if (x2 > fullDomain.x2) {
    x1 -= x2 - fullDomain.x2;
    x2 = fullDomain.x2;
  }

  x1 = Math.max(fullDomain.x1, x1);
  x2 = Math.min(fullDomain.x2, x2);

  return {
    x1: Math.round(x1),
    x2: Math.round(x2)
  };
}

/**
 * Spracuje surové dáta z histórie bez vkladania "offline" nulových bodov.
 *
 * Prečo:
 * - pri prepínaní 6h / 12h / 24h / 48h sa nesmie objaviť sivý loading/offline blok,
 * - graf má ostať stále viditeľný a iba zmeniť časovú os,
 * - X os je ukotvená na posledné reálne meranie, nie na Date.now(), takže keď zariadenie chvíľu
 *   neposlalo dáta, graf sa zbytočne neposúva do prázdneho budúceho úseku.
 */
function processChartData(rawHistory, hours) {
  const points = (Array.isArray(rawHistory) ? rawHistory : [])
    .map(r => ({ ...r, ts: new Date(r.created_at).getTime() }))
    .filter(r => Number.isFinite(r.ts))
    .sort((a, b) => a.ts - b.ts);

  const fallbackEnd = Date.now();
  const latestPointTs = points.length > 0 ? points[points.length - 1].ts : fallbackEnd;
  const rangeEnd = Math.max(latestPointTs, fallbackEnd);
  const rangeStart = rangeEnd - hours * 60 * 60 * 1000;
  const bufferStart = rangeEnd - MAX_CHART_HOURS * 60 * 60 * 1000;

  const bufferPoints = points.filter(point => point.ts >= bufferStart && point.ts <= rangeEnd);

  return {
    chartData: bufferPoints,
    domain: [rangeStart, rangeEnd],
    ticks: generateTicks(rangeStart, rangeEnd)
  };
}

function getVisibleChartData(data, domain) {
  if (!domain || !Array.isArray(data) || data.length === 0) return data;
  return data.filter(point => point.ts >= domain.x1 && point.ts <= domain.x2);
}

function getMetricValues(data, metric) {
  return (Array.isArray(data) ? data : [])
    .filter(point => !point?.offline)
    .map(point => point?.[metric])
    .filter(value => typeof value === 'number' && Number.isFinite(value));
}

function getYAxisDomain(visibleData, fallbackData, metric) {
  const visibleValues = getMetricValues(visibleData, metric);
  const fallbackValues = getMetricValues(fallbackData, metric);
  const values = visibleValues.length > 0 ? visibleValues : fallbackValues;

  if (values.length === 0) {
    return METRIC_DEFAULT_DOMAINS[metric] || [0, 100];
  }

  let min = Math.min(...values);
  let max = Math.max(...values);

  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.1);
    min -= pad;
    max += pad;
  } else {
    const pad = (max - min) * 0.15;
    min -= pad;
    max += pad;
  }

  if (metric === 'soil_moisture' || metric === 'humidity' || metric === 'light_lux') {
    min = Math.max(0, min);
  }

  const defaultDomain = METRIC_DEFAULT_DOMAINS[metric];
  if (defaultDomain) {
    min = Math.max(defaultDomain[0], min);
    max = Math.min(defaultDomain[1], Math.max(max, min + 1));
  }

  return [Math.floor(min * 10) / 10, Math.ceil(max * 10) / 10];
}

function CustomMetricTooltip({ active, payload, label, metricConfig }) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload.find(item => item?.value != null && Number.isFinite(item.value));
  if (!point || point?.payload?.offline) return null;

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(8px)',
        border: 'none',
        borderRadius: '12px',
        fontSize: '12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
        padding: '10px 14px'
      }}
    >
      <div style={{ color: '#3c4435', fontWeight: 700, marginBottom: 4, fontSize: '11px' }}>
        {formatTooltipLabel(label)}
      </div>
      <div style={{ color: '#566349' }}>
        {Math.round(point.value * 10) / 10}{metricConfig.unit}
      </div>
    </div>
  );
}

function CustomTooltipCursor({ points, payload, viewBox, color }) {
  const isOffline = Array.isArray(payload) && payload.some(item => item?.payload?.offline);
  if (isOffline || !points || !points[0]) return null;

  const x = points[0].x;
  const y1 = viewBox?.y ?? 0;
  const y2 = y1 + (viewBox?.height ?? 0);

  return (
    <line
      x1={x}
      x2={x}
      y1={y1}
      y2={y2}
      stroke={color}
      strokeWidth={1}
      strokeDasharray="4 4"
      strokeOpacity={0.5}
    />
  );
}


function formatWateringEta(hours) {
  if (hours == null || !Number.isFinite(hours)) return 'Bez odhadu';
  if (hours <= 0.5) return 'Teraz';
  if (hours < 24) return `Cca ${Math.round(hours)} h`;

  const days = hours / 24;
  if (days < 7) {
    const roundedDays = Math.round(days * 10) / 10;
    return Number.isInteger(roundedDays) ? `Cca ${roundedDays} dňa` : `Cca ${roundedDays} dňa`;
  }

  return 'Viac dní';
}

function getSoilPoints(rawHistory) {
  return (Array.isArray(rawHistory) ? rawHistory : [])
    .map(point => ({
      ...point,
      ts: new Date(point.created_at).getTime()
    }))
    .filter(point => Number.isFinite(point.ts) && typeof point.soil_moisture === 'number' && Number.isFinite(point.soil_moisture))
    .sort((a, b) => a.ts - b.ts);
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getSmartWateringInsights(plant, rawHistory, waterLog, analysis) {
  const soilPoints = getSoilPoints(rawHistory);
  const minSoil = plant?.min_soil_moisture ?? 30;

  if (soilPoints.length < 2) {
    return [
      {
        key: 'eta',
        icon: Clock3,
        label: 'Ďalšie polievanie',
        value: 'Málo dát',
        description: 'Na presnejší odhad potrebujem aspoň pár meraní vlhkosti.',
        tone: 'slate'
      },
      {
        key: 'trend',
        icon: TrendingDown,
        label: 'Trend vlhkosti',
        value: 'Neznámy',
        description: 'Zatiaľ sa nedá spoľahlivo určiť, či vlhkosť klesá rýchlo alebo pomaly.',
        tone: 'slate'
      },
      {
        key: 'reaction',
        icon: Activity,
        label: 'Reakcia po poliatí',
        value: 'Bez dát',
        description: 'Po ďalšom poliatí viem skontrolovať, či senzor naozaj zareagoval.',
        tone: 'slate'
      }
    ];
  }

  const latestPoint = soilPoints[soilPoints.length - 1];
  const recentWindowStart = latestPoint.ts - 8 * 60 * 60 * 1000;
  const recentPoints = soilPoints.filter(point => point.ts >= recentWindowStart);
  const trendPoints = recentPoints.length >= 3 ? recentPoints : soilPoints.slice(-Math.min(8, soilPoints.length));
  const trendStart = trendPoints[0];
  const trendDurationHours = Math.max((latestPoint.ts - trendStart.ts) / 3600000, 1 / 60);
  const moistureDropPerHour = Math.max(0, (trendStart.soil_moisture - latestPoint.soil_moisture) / trendDurationHours);
  const distanceToMin = latestPoint.soil_moisture - minSoil;

  let estimatedHours = null;
  if (typeof analysis?.next_watering_hours === 'number' && Number.isFinite(analysis.next_watering_hours)) {
    estimatedHours = analysis.next_watering_hours;
  } else if (distanceToMin <= 0) {
    estimatedHours = 0;
  } else if (moistureDropPerHour >= 0.08) {
    estimatedHours = clampNumber(distanceToMin / moistureDropPerHour, 0, 24 * 14);
  }

  let etaValue = formatWateringEta(estimatedHours);
  let etaDescription = estimatedHours == null
    ? `Vlhkosť je ${Math.round(latestPoint.soil_moisture * 10) / 10}% a trend je zatiaľ príliš stabilný na presný odhad.`
    : estimatedHours <= 0.5
      ? `Aktuálna vlhkosť ${Math.round(latestPoint.soil_moisture * 10) / 10}% je pod minimom ${minSoil}%.`
      : `Pri súčasnom poklese by mala rastlina klesnúť k hranici ${minSoil}% približne za ${formatWateringEta(estimatedHours).toLowerCase()}.`;
  let etaTone = estimatedHours != null && estimatedHours <= 6 ? 'red' : estimatedHours != null && estimatedHours <= 24 ? 'amber' : 'blue';
  if (estimatedHours == null) etaTone = 'slate';

  let trendValue = 'Stabilná';
  let trendDescription = 'Vlhkosť sa drží približne na rovnakej úrovni.';
  let trendTone = 'green';

  if (moistureDropPerHour >= 1.2) {
    trendValue = 'Klesá rýchlo';
    trendDescription = `Za posledných ${Math.max(1, Math.round(trendDurationHours))} h klesala asi o ${moistureDropPerHour.toFixed(1)} % za hodinu.`;
    trendTone = 'red';
  } else if (moistureDropPerHour >= 0.35) {
    trendValue = 'Klesá pomaly';
    trendDescription = `Trend je zostupný, približne ${moistureDropPerHour.toFixed(1)} % za hodinu.`;
    trendTone = 'amber';
  } else if (moistureDropPerHour > 0.08) {
    trendValue = 'Klesá veľmi mierne';
    trendDescription = `Pokles je zatiaľ mierny, približne ${moistureDropPerHour.toFixed(1)} % za hodinu.`;
    trendTone = 'blue';
  }

  const sortedWaterLog = (Array.isArray(waterLog) ? waterLog : [])
    .map(item => ({ ...item, ts: new Date(item.created_at).getTime() }))
    .filter(item => Number.isFinite(item.ts))
    .sort((a, b) => b.ts - a.ts);

  let reactionValue = 'Bez záznamu';
  let reactionDescription = 'Keď zaznamenáš polievanie, skontrolujem, či sa vlhkosť po ňom naozaj zdvihla.';
  let reactionTone = 'slate';

  if (sortedWaterLog.length > 0) {
    const lastWater = sortedWaterLog[0];
    const beforePoint = [...soilPoints].reverse().find(point => point.ts <= lastWater.ts && point.ts >= lastWater.ts - 6 * 60 * 60 * 1000);
    const afterPoints = soilPoints.filter(point => point.ts > lastWater.ts && point.ts <= lastWater.ts + 6 * 60 * 60 * 1000);

    if (!beforePoint || afterPoints.length === 0) {
      reactionValue = 'Čaká na dáta';
      reactionDescription = 'Po poslednom poliatí ešte nemám dosť meraní na vyhodnotenie reakcie senzora.';
      reactionTone = 'slate';
    } else {
      const bestAfter = afterPoints.reduce((best, point) => point.soil_moisture > best.soil_moisture ? point : best, afterPoints[0]);
      const delta = bestAfter.soil_moisture - beforePoint.soil_moisture;
      const waterTime = new Date(lastWater.ts).toLocaleString('sk', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });

      if (delta >= 2) {
        reactionValue = `Senzor zareagoval +${Math.round(delta * 10) / 10}%`;
        reactionDescription = `Po poliatí ${waterTime} stúpla vlhkosť z ${Math.round(beforePoint.soil_moisture * 10) / 10}% na ${Math.round(bestAfter.soil_moisture * 10) / 10}%.`;
        reactionTone = 'green';
      } else if (delta >= 0.5) {
        reactionValue = 'Reakcia je slabšia';
        reactionDescription = `Po poslednom poliatí stúpla vlhkosť len o ${Math.round(delta * 10) / 10}%. Oplatí sa skontrolovať dávku vody alebo umiestnenie senzora.`;
        reactionTone = 'amber';
      } else {
        reactionValue = 'Senzor nereagoval';
        reactionDescription = `Po poliatí ${waterTime} sa vlhkosť takmer nezmenila. Skontroluj, či voda trafila koreňovú zónu a senzor.`;
        reactionTone = 'red';
      }
    }
  }

  return [
    {
      key: 'eta',
      icon: Clock3,
      label: 'Ďalšie polievanie',
      value: etaValue,
      description: etaDescription,
      tone: etaTone
    },
    {
      key: 'trend',
      icon: TrendingDown,
      label: 'Trend vlhkosti',
      value: trendValue,
      description: trendDescription,
      tone: trendTone
    },
    {
      key: 'reaction',
      icon: Activity,
      label: 'Reakcia po poliatí',
      value: reactionValue,
      description: reactionDescription,
      tone: reactionTone
    }
  ];
}

const INSIGHT_TONE_STYLES = {
  blue: {
    card: 'border-blue-100 dark:border-blue-900/20 bg-blue-50 dark:bg-blue-950/20/50 dark:bg-blue-950/20',
    iconWrap: 'bg-blue-100 dark:bg-blue-900/20',
    icon: 'text-blue-600 dark:text-blue-400'
  },
  green: {
    card: 'border-green-100 dark:border-green-900/30 bg-green-50 dark:bg-green-950/40/50 dark:bg-green-900/30',
    iconWrap: 'bg-green-100 dark:bg-green-900/30',
    icon: 'text-green-600 dark:text-green-500'
  },
  amber: {
    card: 'border-amber-100 dark:border-amber-900/20 bg-amber-50 dark:bg-amber-950/20/60 dark:bg-amber-950/20',
    iconWrap: 'bg-amber-100 dark:bg-amber-900/20',
    icon: 'text-amber-600 dark:text-amber-400'
  },
  red: {
    card: 'border-red-100 dark:border-red-900/20 bg-red-50 dark:bg-red-950/20/60 dark:bg-red-950/20',
    iconWrap: 'bg-red-100 dark:bg-red-900/20',
    icon: 'text-red-600 dark:text-red-400'
  },
  slate: {
    card: 'border-sage-100 dark:border-green-900/20 bg-sage-50 dark:bg-green-950/40/70 dark:bg-green-950/40',
    iconWrap: 'bg-white dark:bg-green-950/50',
    icon: 'text-sage-500 dark:text-green-700'
  }
};

export default function PlantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plant, setPlant] = useState(null);
  const [history, setHistory] = useState([]);
  const [latest, setLatest] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [waterLog, setWaterLog] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [hours, setHours] = useState(24);
  const [metric, setMetric] = useState('soil_moisture');
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [zoomDomain, setZoomDomain] = useState(null);
  const chartContainerRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, startDomain: null });
  const pinchRef = useRef({ active: false, startDistance: 0, startDomain: null });

  const handleHoursChange = useCallback((h) => {
    setHours(h);
    setZoomDomain(null);
  }, []);

  const getFullDomain = useCallback(() => {
    const { ticks: t } = processChartData(history, hours);
    if (!t || t.length < 2) return null;
    return { x1: t[0], x2: t[t.length - 1] };
  }, [history, hours]);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const onWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const full = getFullDomain();
      if (!full) return;

      const currentX1 = zoomDomain ? zoomDomain.x1 : full.x1;
      const currentX2 = zoomDomain ? zoomDomain.x2 : full.x2;
      const range = currentX2 - currentX1;

      const rect = container.getBoundingClientRect();
      const mouseRatio = getRelativeChartX(e.clientX, rect);
      const zoomFactor = e.deltaY < 0 ? 0.8 : 1.25;
      const newRange = range * zoomFactor;
      const maxRange = full.x2 - full.x1;
      const clampedRange = Math.max(MIN_ZOOM_RANGE_MS, Math.min(maxRange, newRange));

      if (clampedRange >= maxRange * 0.99) {
        setZoomDomain(null);
        return;
      }

      const center = currentX1 + mouseRatio * range;
      const nextDomain = clampZoomDomain({
        x1: center - mouseRatio * clampedRange,
        x2: center + (1 - mouseRatio) * clampedRange
      }, full);

      setZoomDomain(nextDomain);
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [zoomDomain, getFullDomain]);

  const handleMouseDown = useCallback((e) => {
    if (!zoomDomain) return;
    e.preventDefault();
    dragRef.current = { active: true, startX: e.clientX, startDomain: { ...zoomDomain } };
    document.body.style.userSelect = 'none';
  }, [zoomDomain]);

  const handleMouseMove = useCallback((e) => {
    const drag = dragRef.current;
    if (!drag.active || !drag.startDomain || pinchRef.current.active) return;

    const container = chartContainerRef.current;
    if (!container) return;

    const full = getFullDomain();
    if (!full) return;

    const rect = container.getBoundingClientRect();
    const chartWidth = getChartWidth(rect);
    const range = drag.startDomain.x2 - drag.startDomain.x1;
    const pxDelta = drag.startX - e.clientX;
    const tsDelta = (pxDelta / chartWidth) * range;

    setZoomDomain(clampZoomDomain({
      x1: drag.startDomain.x1 + tsDelta,
      x2: drag.startDomain.x2 + tsDelta
    }, full));
  }, [getFullDomain]);

  const handleMouseUp = useCallback(() => {
    dragRef.current.active = false;
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleTouchStart = useCallback((e) => {
    const full = getFullDomain();
    const container = chartContainerRef.current;
    if (!full || !container) return;

    if (e.touches.length === 2) {
      e.preventDefault();
      const [touchA, touchB] = e.touches;
      pinchRef.current = {
        active: true,
        startDistance: getTouchDistance(touchA, touchB),
        startDomain: zoomDomain ? { ...zoomDomain } : { ...full }
      };
      dragRef.current.active = false;
      return;
    }

    if (e.touches.length === 1 && zoomDomain) {
      e.preventDefault();
      dragRef.current = {
        active: true,
        startX: e.touches[0].clientX,
        startDomain: { ...zoomDomain }
      };
    }
  }, [zoomDomain, getFullDomain]);

  const handleTouchMove = useCallback((e) => {
    const container = chartContainerRef.current;
    const full = getFullDomain();
    if (!container || !full) return;

    if (pinchRef.current.active && e.touches.length === 2) {
      e.preventDefault();
      const [touchA, touchB] = e.touches;
      const rect = container.getBoundingClientRect();
      const currentDistance = getTouchDistance(touchA, touchB);
      const startDistance = Math.max(1, pinchRef.current.startDistance);
      const startDomain = pinchRef.current.startDomain || full;
      const startRange = startDomain.x2 - startDomain.x1;
      const scale = currentDistance / startDistance;
      const newRange = startRange / Math.max(0.25, scale);
      const maxRange = full.x2 - full.x1;
      const clampedRange = Math.max(MIN_ZOOM_RANGE_MS, Math.min(maxRange, newRange));

      if (clampedRange >= maxRange * 0.99) {
        setZoomDomain(null);
        return;
      }

      const centerClientX = (touchA.clientX + touchB.clientX) / 2;
      const centerRatio = getRelativeChartX(centerClientX, rect);
      const centerTs = startDomain.x1 + centerRatio * startRange;

      setZoomDomain(clampZoomDomain({
        x1: centerTs - centerRatio * clampedRange,
        x2: centerTs + (1 - centerRatio) * clampedRange
      }, full));
      return;
    }

    const drag = dragRef.current;
    if (drag.active && drag.startDomain && e.touches.length === 1) {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const chartWidth = getChartWidth(rect);
      const range = drag.startDomain.x2 - drag.startDomain.x1;
      const pxDelta = drag.startX - e.touches[0].clientX;
      const tsDelta = (pxDelta / chartWidth) * range;

      setZoomDomain(clampZoomDomain({
        x1: drag.startDomain.x1 + tsDelta,
        x2: drag.startDomain.x2 + tsDelta
      }, full));
    }
  }, [getFullDomain]);

  const handleTouchEnd = useCallback((e) => {
    if (e.touches.length < 2) {
      pinchRef.current.active = false;
    }

    if (e.touches.length === 0) {
      dragRef.current.active = false;
    } else if (e.touches.length === 1 && zoomDomain) {
      dragRef.current = {
        active: true,
        startX: e.touches[0].clientX,
        startDomain: zoomDomain ? { ...zoomDomain } : null
      };
    }
  }, [zoomDomain]);

  useEffect(() => {
    let mounted = true;

    const loadInitial = async () => {
      setLoading(true);
      try {
        const p = await getPlant(id);
        if (!mounted) return;
        setPlant(p);

        const [h, l, w, a] = await Promise.all([
          getSensorHistory(p.device_id, MAX_CHART_HOURS),
          getLatestReading(p.device_id),
          getWateringHistory(id).catch(() => []),
          getAnalysisHistory(id, 1).catch(() => [])
        ]);

        if (!mounted) return;
        setHistory(h || []);
        setLatest(l || p.latest_reading || null);
        setWaterLog(w || []);
        setAnalysis(a?.length ? a[0] : null);
        setDemoMode(false);
      } catch {
        if (!mounted) return;
        setPlant(DEMO_PLANT);
        const h = demoHistory();
        setHistory(h);
        setLatest(h[h.length - 1]);
        setAnalysis({
          health_score: 85,
          status: 'ok',
          summary: 'Rastlina je v dobrom stave.',
          recommendations: [{ priority: 'low', action: 'Pokračujte v polievaní', reason: 'Parametre sú v norme.' }],
          watering_needed: false,
          ai_success: true,
          ai_provider: 'groq'
        });
        setWaterLog([]);
        setDemoMode(true);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadInitial();

    return () => {
      mounted = false;
    };
  }, [id]);

  // Pri prepínaní 6h / 12h / 24h / 48h už nefetchneme nové dáta.
  // Držíme 48h buffer a mení sa iba X/Y rozsah grafu, takže graf ostane viditeľný
  // a prechod je plynulý bez bieleho loading overlayu.

  useEffect(() => {
    if (!plant?.device_id || demoMode) return undefined;

    let cancelled = false;

    const refreshLive = async () => {
      try {
        const [h, l] = await Promise.all([
          getSensorHistory(plant.device_id, MAX_CHART_HOURS),
          getLatestReading(plant.device_id)
        ]);

        if (cancelled) return;
        setHistory(h || []);
        setLatest(l || null);
      } catch {
        // silent live refresh fail
      }
    };

    const interval = window.setInterval(refreshLive, LIVE_REFRESH_MS);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshLive();
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [plant?.device_id, demoMode]);

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      setAnalysis(await analyzeHealth(id));
    } catch {
      alert('AI analýza zlyhala.');
    }
    setAnalyzing(false);
  }

  async function handleWater() {
    try {
      await waterPlant(id, { notes: 'Manuálne polievanie' });
      const [h, l, w] = await Promise.all([
        getSensorHistory(plant.device_id, MAX_CHART_HOURS).catch(() => history),
        getLatestReading(plant.device_id).catch(() => latest),
        getWateringHistory(id).catch(() => waterLog)
      ]);
      setHistory(h || []);
      setLatest(l || latest);
      setWaterLog(w || []);
    } catch {
      // ignore
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Naozaj chcete odstrániť "${plant.name}"? Táto akcia je nevratná.`)) return;
    try {
      await deletePlant(id);
      navigate('/');
    } catch {
      alert('Chyba pri odstraňovaní rastliny.');
    }
  }

  const activeMetric = useMemo(() => METRICS.find(m => m.key === metric), [metric]);
  const deviceStatus = latest || plant?.latest_reading
    ? getDeviceStatus(latest || plant?.latest_reading)
    : normalizeDeviceStatus(plant?.device_status);

  const { chartData, domain: baseChartDomain, ticks } = useMemo(
    () => processChartData(history, hours),
    [history, hours]
  );

  const chartDomain = zoomDomain ? [zoomDomain.x1, zoomDomain.x2] : baseChartDomain;
  const visibleChartData = useMemo(
    () => getVisibleChartData(chartData, { x1: chartDomain[0], x2: chartDomain[1] }),
    [chartData, chartDomain]
  );
  const yAxisDomain = useMemo(
    () => getYAxisDomain(visibleChartData, chartData, metric),
    [visibleChartData, chartData, metric]
  );
  const renderedChartData = useMemo(
    () => chartData.map(point => ({
      ...point,
      renderValue: typeof point?.[metric] === 'number' && Number.isFinite(point[metric])
        ? point[metric]
        : null
    })),
    [chartData, metric]
  );

  const smartWateringInsights = useMemo(
    () => getSmartWateringInsights(plant, history, waterLog, analysis),
    [plant, history, waterLog, analysis]
  );

  const aiSuccess = analysis?.ai_success === true ||
    (analysis?.summary && !analysis.summary.includes('lokálne') && !analysis.summary.includes('nedostupná'));
  const aiProvider = analysis?.ai_provider === 'groq' ? 'Groq (Llama 3.3)' :
    analysis?.ai_provider === 'gemini' ? 'Google Gemini' :
      (analysis?.ai_provider === 'fallback' ? 'Lokálna analýza' :
        (aiSuccess ? 'AI' : 'Lokálna analýza'));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-green-200 dark:border-green-800/30 border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!plant) return null;

  const r = latest || {};
  const xTickHours = zoomDomain
    ? (zoomDomain.x2 - zoomDomain.x1 > 24 * 3600000 ? 48 : 6)
    : hours;
  const showDateOnTicks = shouldShowDateOnTicks(chartDomain[0], chartDomain[1]) || xTickHours >= 48;

  return (
    <div className="space-y-4 sm:space-y-5 page-shell">
      <div className="flex items-start justify-between gap-3 sm:gap-4 section-reveal stagger-1">
        <div className="flex items-start gap-3 min-w-0">
          <Link to="/" className="p-2 -ml-2 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/30 dark:bg-green-950/40 transition-colors">
            <ArrowLeft className="w-5 h-5 text-sage-500 dark:text-green-700" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-green-900 dark:text-green-100 truncate flex items-center gap-2">
              <span className="text-xl sm:text-2xl select-none shrink-0">{getPlantEmoji(plant)}</span>
              <span className="truncate">{plant.name}</span>
              <span className="md:hidden shrink-0">
                <MobileStatusBadge status={deviceStatus} />
              </span>
            </h1>
            <p className="text-sm text-sage-500 dark:text-green-700 truncate">{plant.species} · {plant.location}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <DeviceChip deviceId={plant.device_id} status={deviceStatus} />
          <button onClick={() => setEditOpen(true)} className="btn-secondary px-2.5 sm:px-3 py-2 sm:py-2.5" title="Upraviť rastlinu">
            <PencilLine className="w-4 h-4" />
            <span className="hidden sm:inline">Upraviť</span>
          </button>
          <button
            onClick={handleDelete}
            className="p-2 sm:p-2.5 rounded-xl text-sage-400 dark:text-green-700 hover:text-red-500 dark:text-red-400 hover:bg-red-50 dark:bg-red-950/20 transition-all"
            title="Odstrániť rastlinu"
          >
            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 section-reveal stagger-2">
        {METRICS.map(m => {
          const val = r[m.key];
          const active = metric === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`card p-4 text-left transition-all ${active ? 'ring-2 ring-green-400/40 border-green-200 dark:border-green-800/30' : ''}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <m.icon className="w-4 h-4" style={{ color: m.color }} />
                <span className="text-xs text-sage-500 dark:text-green-700">{m.label}</span>
              </div>
              <p className="text-xl font-bold text-green-900 dark:text-green-100">
                {val != null ? Math.round(val * 10) / 10 : '—'}
                <span className="text-sm font-normal text-sage-400 dark:text-green-700">{m.unit}</span>
              </p>
            </button>
          );
        })}
      </div>

      <div className="card overflow-hidden section-reveal stagger-3">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${activeMetric.color}14` }}>
              <activeMetric.icon className="w-4 h-4" style={{ color: activeMetric.color }} />
            </div>
            <h2 className="font-semibold text-green-900 dark:text-green-100 truncate">{activeMetric.label}</h2>
          </div>
          <div className="flex gap-0.5 bg-sage-50 dark:bg-green-950/40 rounded-xl p-1 shrink-0">
            {[6, 12, 24, 48].map(h => (
              <button
                key={h}
                onClick={() => handleHoursChange(h)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  hours === h
                    ? 'bg-white dark:bg-green-950/50 text-green-700 dark:text-green-500 shadow-sm ring-1 ring-sage-100'
                    : 'text-sage-400 dark:text-green-700 hover:text-sage-600 dark:text-green-700'
                }`}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>

        <div
          ref={chartContainerRef}
          className={`relative px-2 sm:px-3 pb-4 chart-appear ${zoomDomain ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          style={{ touchAction: 'none' }}
        >
          {visibleChartData.length === 0 ? (
            <div className="flex items-center justify-center h-[260px] text-sm text-sage-400 dark:text-green-700">
              Žiadne dáta pre zvolený interval
            </div>
          ) : (
            <>
              <ProfessionalMetricChart
                data={renderedChartData}
                metric={metric}
                metricConfig={activeMetric}
                domain={chartDomain}
                yDomain={yAxisDomain}
                ticks={zoomDomain ? generateTicks(zoomDomain.x1, zoomDomain.x2) : ticks}
                yTicks={generateNumericTicks(yAxisDomain[0], yAxisDomain[1])}
                showDateOnTicks={showDateOnTicks}
              />

              <div className="flex items-center justify-between px-3 mt-1 gap-3">
                <div className="flex items-center gap-3 min-h-[16px]">
                  {deviceStatus?.isOffline && (
                    <div className="flex items-center gap-1.5 text-[10px] text-sage-400 dark:text-green-700">
                      <span className="inline-block w-2 h-2 rounded-full bg-red-400/70 dark:bg-red-500/40" />
                      Offline úsek je v grafe zvýraznený
                    </div>
                  )}
                </div>
                <div className="text-[11px] sm:text-xs text-sage-400 dark:text-green-700 text-right">
                  Aktualizované: <span className="font-medium text-sage-500 dark:text-green-700">{formatUpdatedAt(r.created_at)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 section-reveal stagger-4">
        <button onClick={handleWater} className="btn-secondary w-full justify-center px-3 min-w-0 py-2.5 sm:py-2.5">
          <Droplet className="w-4 h-4 shrink-0" />
          <span className="truncate sm:hidden">Polievanie</span>
          <span className="truncate hidden sm:inline">Zaznamenať polievanie</span>
        </button>
        <button onClick={handleAnalyze} disabled={analyzing} className="btn-primary disabled:opacity-50 w-full justify-center px-3 min-w-0 py-2.5 sm:py-2.5">
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Brain className="w-4 h-4 shrink-0" />}
          <span className="truncate">{analyzing ? 'Analyzujem...' : 'AI Analýza'}</span>
        </button>
      </div>

      <div className="card p-4 sm:p-5 mobile-compact-card section-reveal stagger-5">
        <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-semibold text-green-900 dark:text-green-100 flex items-center gap-2 text-[15px] sm:text-base">
              <Droplets className="w-4 h-4 text-blue-500 dark:text-blue-400" /> Smart odporúčanie polievania
            </h3>
            <p className="text-[11px] sm:text-xs text-sage-400 dark:text-green-700 mt-0.5 sm:mt-1 leading-relaxed mobile-two-line">
              Odhad je postavený na priebehu vlhkosti, poslednom poliatí a reakcii senzora.
            </p>
          </div>
          <span className="self-start rounded-lg bg-sage-50 dark:bg-green-950/40 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-medium text-sage-500 dark:text-green-700">
            Živé insighty
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:gap-3 md:grid-cols-3">
          {smartWateringInsights.map((insight) => {
            const tone = INSIGHT_TONE_STYLES[insight.tone] || INSIGHT_TONE_STYLES.slate;
            const Icon = insight.icon;
            return (
              <div key={insight.key} className={`rounded-2xl border p-3 sm:p-4 mobile-compact-card ${tone.card}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] sm:text-xs font-medium text-sage-500 dark:text-green-700">{insight.label}</p>
                    <p className="mt-0.5 sm:mt-1 text-[15px] sm:text-lg font-semibold text-green-900 dark:text-green-100 leading-tight">{insight.value}</p>
                  </div>
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${tone.iconWrap}`}>
                    <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${tone.icon}`} />
                  </div>
                </div>
                <p className="mt-2 sm:mt-3 text-[11px] sm:text-xs text-sage-500 dark:text-green-700 leading-relaxed mobile-two-line">{insight.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {analysis && (
        <div className="card p-4 sm:p-5 fade-in section-reveal stagger-6 mobile-compact-card">
          <div className="mb-3 sm:mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-start sm:gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <GaugeRing
                value={analysis.health_score || 0}
                size={48}
                strokeWidth={4}
                color={(analysis.health_score || 0) >= 70 ? '#22c55e' : (analysis.health_score || 0) >= 40 ? '#eab308' : '#ef4444'}
              >
                <span className="text-xs sm:text-sm font-bold">{analysis.health_score}</span>
              </GaugeRing>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-green-900 dark:text-green-100 inline-flex items-center gap-2 leading-tight text-[15px] sm:text-base">
                    <Brain className="w-4 h-4 text-green-500 dark:text-green-500 shrink-0" />
                    <span>AI Analýza</span>
                  </h3>
                  {aiSuccess ? <CheckCircle className="w-4 h-4 text-green-500 dark:text-green-500 shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 dark:text-red-500 shrink-0" />}
                </div>
                <div className="mt-0.5 sm:mt-1 flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-sage-400 dark:text-green-700">
                  <span className="truncate max-w-full">{aiProvider}</span>
                  {aiSuccess ? (
                    <span className="inline-flex px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-500 text-[10px] font-semibold">OK</span>
                  ) : (
                    <span className="inline-flex px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/20 text-red-500 dark:text-red-400 text-[10px] font-semibold">OFFLINE</span>
                  )}
                </div>
              </div>
            </div>
            {analysis.watering_needed && (
              <span className="self-start sm:ml-auto px-2.5 sm:px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 text-[11px] sm:text-xs font-semibold inline-flex items-center gap-1">
                <Droplet className="w-3 h-3 shrink-0" /> Treba poliať
              </span>
            )}
          </div>

          <p className="text-[13px] sm:text-sm text-sage-600 dark:text-green-700 mb-3 sm:mb-4 leading-relaxed">{analysis.summary}</p>

          {analysis.recommendations?.length > 0 && (
            <div className="space-y-2">
              {analysis.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl bg-sage-50 dark:bg-green-950/40">
                  <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                    rec.priority === 'high' ? 'bg-red-400 dark:bg-red-500' : rec.priority === 'medium' ? 'bg-amber-400 dark:bg-amber-500' : 'bg-green-400 dark:bg-green-500'
                  }`} />
                  <div className="min-w-0">
                    <p className="text-[13px] sm:text-sm font-medium text-green-900 dark:text-green-100">{rec.action}</p>
                    <p className="text-[11px] sm:text-xs text-sage-500 dark:text-green-700 mt-0.5 leading-relaxed mobile-two-line">{rec.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {waterLog.length > 0 && (
        <div className="card p-4 sm:p-5 section-reveal stagger-6 mobile-compact-card">
          <h3 className="font-semibold text-green-900 dark:text-green-100 flex items-center gap-2 mb-3 text-[15px] sm:text-base">
            <Clock className="w-4 h-4 text-sage-400 dark:text-green-700" /> História polievania
          </h3>
          <div className="space-y-2">
            {waterLog.slice(0, 5).map((w, i) => (
              <div key={i} className="flex items-center justify-between text-[13px] sm:text-sm px-3 py-2 rounded-xl bg-sage-50 dark:bg-green-950/40 gap-3">
                <span className="text-green-900 dark:text-green-100 min-w-0">{new Date(w.created_at).toLocaleString('sk')}</span>
                <span className="text-sage-400 dark:text-green-700 text-right">{w.amount_ml ? `${w.amount_ml} ml` : ''} {w.notes || ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <PlantEditModal
        isOpen={editOpen}
        plant={plant}
        onClose={() => setEditOpen(false)}
        onSaved={(updatedPlant) => {
          setPlant(updatedPlant);
        }}
      />
    </div>
  );
}

function DeviceChip({ deviceId, status }) {
  const isOnline = isDeviceOnline(status);
  const dotClass = isOnline ? 'bg-green-500 dark:bg-green-500' : 'bg-red-400 dark:bg-red-500';
  const labelClass = isOnline ? 'text-green-600 dark:text-green-500' : 'text-red-500 dark:text-red-400';
  const label = isOnline ? 'Online' : 'Offline';

  return (
    <div className="hidden md:flex items-center gap-2 rounded-2xl border border-sage-100 dark:border-green-900/20 bg-white dark:bg-green-950/50 px-3 py-2 min-w-0">
      <span className="truncate text-xs text-sage-500 dark:text-green-700">{deviceId || 'Bez zariadenia'}</span>
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${labelClass}`}>
        <span className="relative flex h-2 w-2">
          {isOnline && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 dark:bg-green-500 opacity-75" />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotClass}`} />
        </span>
        {label}
      </span>
    </div>
  );
}

function MobileStatusBadge({ status }) {
  const isOnline = isDeviceOnline(status);
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${isOnline ? 'text-green-600 dark:text-green-500' : 'text-red-500 dark:text-red-400'}`}>
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOnline ? 'bg-green-500 dark:bg-green-500' : 'bg-red-400 dark:bg-red-500'}`} />
      {isOnline ? 'Online' : 'Offline'}
    </span>
  );
}
