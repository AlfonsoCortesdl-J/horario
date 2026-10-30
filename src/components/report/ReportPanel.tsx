'use client';

import { useState } from 'react';
import { generateWeeklyReport, WeeklyReportData } from '@/app/actions/report';
import {
  FileText,
  Download,
  RefreshCw,
  Users,
  Clock,
  Calendar,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  User,
} from 'lucide-react';

const DAY_ORDER = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

async function downloadAsPDF(report: WeeklyReportData) {
  // Importación dinámica para no aumentar bundle inicial
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW = 210;
  const margin = 14;
  let y = margin;

  // ── Paleta ──────────────────────────────────────────────────────────────────
  const C = {
    bg: [9, 9, 11] as [number, number, number],
    zinc800: [39, 39, 42] as [number, number, number],
    zinc700: [63, 63, 70] as [number, number, number],
    zinc400: [161, 161, 170] as [number, number, number],
    zinc100: [244, 244, 245] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    emerald: [52, 211, 153] as [number, number, number],
    amber: [251, 191, 36] as [number, number, number],
  };

  // ── Fondo página ────────────────────────────────────────────────────────────
  doc.setFillColor(...C.bg);
  doc.rect(0, 0, pageW, 297, 'F');

  // ── Encabezado ──────────────────────────────────────────────────────────────
  doc.setFillColor(...C.zinc800);
  doc.roundedRect(margin, y, pageW - margin * 2, 28, 3, 3, 'F');

  doc.setTextColor(...C.white);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Reporte Semanal de Disponibilidad', margin + 5, y + 10);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.zinc400);
  doc.text(`Equipo TecMM Zapopan · Semana del ${fmtShortDate(report.weekStart)}`, margin + 5, y + 17);
  doc.text(`Generado por ${report.generatedBy} el ${fmtDate(report.generatedAt)}`, margin + 5, y + 23);
  y += 34;

  // ── Tarjetas de resumen ──────────────────────────────────────────────────────
  const cards = [
    { label: 'Miembros activos', value: `${report.totalActiveMembers}`, sub: 'con disponibilidad' },
    { label: 'Horas del equipo', value: `${report.teamTotalHours}h`, sub: 'total acumulado' },
    { label: 'Día más activo', value: report.mostActiveDay, sub: 'mayor cobertura' },
  ];

  const cardW = (pageW - margin * 2 - 8) / 3;
  cards.forEach((c, i) => {
    const cx = margin + i * (cardW + 4);
    doc.setFillColor(...C.zinc800);
    doc.roundedRect(cx, y, cardW, 20, 2, 2, 'F');
    doc.setTextColor(...C.emerald);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(c.value, cx + 4, y + 10);
    doc.setTextColor(...C.zinc400);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(c.label, cx + 4, y + 15);
    doc.text(c.sub, cx + 4, y + 19);
  });
  y += 26;

  // ── Cobertura por día ────────────────────────────────────────────────────────
  doc.setFillColor(...C.zinc800);
  doc.roundedRect(margin, y, pageW - margin * 2, 30, 2, 2, 'F');
  doc.setTextColor(...C.white);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Cobertura por día (personas disponibles)', margin + 4, y + 7);

  const activeDays = DAY_ORDER.filter((d) => d in report.coverageByDay);
  if (activeDays.length > 0) {
    const maxCov = Math.max(...Object.values(report.coverageByDay));
    const barAreaW = pageW - margin * 2 - 8;
    const barSlot = barAreaW / 7;
    DAY_ORDER.forEach((day, i) => {
      const count = report.coverageByDay[day] || 0;
      const bx = margin + 4 + i * barSlot;
      const barH = maxCov > 0 ? Math.round((count / maxCov) * 12) : 0;

      // Barra
      if (count > 0) {
        doc.setFillColor(...C.emerald);
        doc.roundedRect(bx, y + 22 - barH, barSlot - 2, barH, 1, 1, 'F');
      }

      // Etiqueta día
      doc.setTextColor(...C.zinc400);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text(day, bx, y + 26, { align: 'left' });

      // Número
      if (count > 0) {
        doc.setTextColor(...C.emerald);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text(String(count), bx, y + 22 - barH - 1);
      }
    });
  } else {
    doc.setTextColor(...C.zinc400);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Sin datos de disponibilidad esta semana', margin + 4, y + 18);
  }
  y += 36;

  // ── Tabla de miembros ────────────────────────────────────────────────────────
  doc.setTextColor(...C.white);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Disponibilidad por integrante', margin, y + 5);
  y += 8;

  // Cabecera tabla
  const cols = [52, 20, 22, 24, 34, 34] as const;
  const headers = ['Nombre', 'Horas', 'Bloques', 'Días', 'Desde', 'Hasta'];
  let cx = margin;
  doc.setFillColor(...C.zinc700);
  doc.rect(margin, y, pageW - margin * 2, 7, 'F');
  headers.forEach((h, i) => {
    doc.setTextColor(...C.zinc100);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text(h, cx + 2, y + 5);
    cx += cols[i];
  });
  y += 8;

  // Filas
  report.members.forEach((m, idx) => {
    const rowH = 8;
    if (idx % 2 === 0) {
      doc.setFillColor(18, 18, 20);
      doc.rect(margin, y, pageW - margin * 2, rowH, 'F');
    }

    const isActive = m.totalSlots > 0;
    doc.setTextColor(...(isActive ? C.zinc100 : C.zinc400));
    doc.setFontSize(7.5);
    doc.setFont('helvetica', isActive ? 'normal' : 'italic');

    const row = [
      m.full_name + (m.role === 'admin' ? ' ★' : ''),
      isActive ? `${m.totalHours}h` : '—',
      isActive ? String(m.totalSlots) : '—',
      isActive ? m.days.join(', ') : '—',
      m.earliestStart,
      m.latestEnd,
    ];

    cx = margin;
    row.forEach((val, i) => {
      doc.text(val, cx + 2, y + 5.5);
      cx += cols[i];
    });

    // Punto de color por actividad
    if (isActive) {
      doc.setFillColor(...C.emerald);
      doc.circle(margin - 3, y + 4, 1, 'F');
    }

    y += rowH;
  });

  // ── Pie de página ────────────────────────────────────────────────────────────
  y += 6;
  doc.setDrawColor(...C.zinc700);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  doc.setTextColor(...C.zinc400);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Coordinación de Presencia · TecMM Zapopan · ${fmtDate(report.generatedAt)}`,
    pageW / 2,
    y,
    { align: 'center' }
  );
  doc.text(
    `Reporte generado por ${report.generatedBy}`,
    pageW / 2,
    y + 4,
    { align: 'center' }
  );

  // ── Guardar ──────────────────────────────────────────────────────────────────
  const fileName = `reporte-disponibilidad-${fmtShortDate(report.generatedAt).replace(/\//g, '-')}.pdf`;
  doc.save(fileName);
}

export default function ReportPanel() {
  const [report, setReport] = useState<WeeklyReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await generateWeeklyReport();
      setReport(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al generar reporte');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!report) return;
    setDownloading(true);
    try {
      await downloadAsPDF(report);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al generar PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-24">
      {/* Header card */}
      <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-zinc-300" />
            <h2 className="text-base font-semibold text-white">Reporte Semanal</h2>
          </div>
          <div className="flex items-center gap-2">
            {report && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold transition-all disabled:opacity-50"
              >
                {downloading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                Descargar PDF
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold transition-all disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {report ? 'Actualizar' : 'Generar Reporte'}
            </button>
          </div>
        </div>
        <p className="text-xs text-zinc-400 pt-2">
          Resumen de disponibilidad del equipo para la semana activa. El reporte quedará firmado con tu nombre.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Empty state */}
      {!report && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-3">
          <FileText className="w-10 h-10 opacity-30" />
          <p className="text-sm">Presiona &quot;Generar Reporte&quot; para ver el resumen de la semana.</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 bg-zinc-900/50 border border-zinc-800/60 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Report content */}
      {report && !loading && (
        <>
          {/* Firmado por */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900/40 border border-zinc-800/60 rounded-xl">
            <User className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-400">
              Generado por{' '}
              <span className="text-zinc-200 font-semibold">{report.generatedBy}</span>
              {' · '}
              <span className="text-zinc-500">{fmtDate(report.generatedAt)}</span>
            </span>
          </div>

          {/* Cards de resumen */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-3.5 flex flex-col gap-1">
              <Users className="w-4 h-4 text-emerald-400" />
              <span className="text-xl font-bold text-white">{report.totalActiveMembers}</span>
              <span className="text-[11px] text-zinc-400 leading-tight">Miembros con disponibilidad</span>
            </div>
            <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-3.5 flex flex-col gap-1">
              <Clock className="w-4 h-4 text-zinc-300" />
              <span className="text-xl font-bold text-white">{report.teamTotalHours}h</span>
              <span className="text-[11px] text-zinc-400 leading-tight">Horas totales del equipo</span>
            </div>
            <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-3.5 flex flex-col gap-1">
              <TrendingUp className="w-4 h-4 text-zinc-300" />
              <span className="text-xl font-bold text-white">{report.mostActiveDay}</span>
              <span className="text-[11px] text-zinc-400 leading-tight">Día con más cobertura</span>
            </div>
          </div>

          {/* Cobertura por día */}
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4">
            <div className="flex items-center gap-2 pb-3 border-b border-zinc-800/60 mb-3">
              <Calendar className="w-4 h-4 text-zinc-400" />
              <h3 className="text-sm font-semibold text-white">Personas disponibles por día</h3>
            </div>
            <div className="flex gap-1.5 items-end h-20">
              {DAY_ORDER.map((day) => {
                const count = report.coverageByDay[day] || 0;
                const max = Math.max(...Object.values(report.coverageByDay), 1);
                const pct = count / max;
                return (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-semibold text-emerald-400">
                      {count > 0 ? count : ''}
                    </span>
                    <div className="w-full rounded-t" style={{ height: `${Math.max(pct * 52, count > 0 ? 4 : 0)}px`, backgroundColor: count > 0 ? '#34d399' : '#27272a', opacity: count > 0 ? 0.7 + pct * 0.3 : 1 }} />
                    <span className="text-[10px] text-zinc-500">{day}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabla de miembros */}
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 p-4 border-b border-zinc-800/60">
              <Users className="w-4 h-4 text-zinc-400" />
              <h3 className="text-sm font-semibold text-white">Disponibilidad por integrante</h3>
            </div>
            <div className="divide-y divide-zinc-800/50">
              {report.members.map((m) => {
                const active = m.totalSlots > 0;
                return (
                  <div
                    key={m.id}
                    className={`px-4 py-3 flex items-center justify-between gap-3 ${active ? '' : 'opacity-40'}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                          active ? 'bg-emerald-950 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        {m.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-zinc-100 truncate">{m.full_name}</span>
                          {m.role === 'admin' && (
                            <span className="text-[9px] text-zinc-500 border border-zinc-700 px-1 rounded flex-shrink-0">
                              Admin
                            </span>
                          )}
                        </div>
                        {active ? (
                          <div className="text-[10px] text-zinc-500 mt-0.5">
                            {m.days.join(' · ')} · {m.earliestStart}–{m.latestEnd}
                          </div>
                        ) : (
                          <div className="text-[10px] text-zinc-600 italic mt-0.5">Sin disponibilidad</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {active ? (
                        <>
                          <div className="text-right">
                            <div className="text-sm font-bold text-white">{m.totalHours}h</div>
                            <div className="text-[10px] text-zinc-500">{m.totalSlots} bloques</div>
                          </div>
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        </>
                      ) : (
                        <div className="text-xs text-zinc-600">—</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
