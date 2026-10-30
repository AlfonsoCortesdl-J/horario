'use client';

import { useState, useEffect } from 'react';
import {
  generateWeeklyReport,
  getTeamMemberOptions,
  WeeklyReportData,
  TeamMemberOption,
} from '@/app/actions/report';
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
  CheckSquare,
  Square,
  Pencil,
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
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW = 210;
  const margin = 14;
  let y = margin;

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

  doc.setFillColor(...C.bg);
  doc.rect(0, 0, pageW, 297, 'F');

  // Encabezado
  doc.setFillColor(...C.zinc800);
  doc.roundedRect(margin, y, pageW - margin * 2, 30, 3, 3, 'F');

  doc.setTextColor(...C.white);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(report.reportTitle, margin + 5, y + 10);

  if (report.isPartial) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.amber);
    doc.text('Reporte parcial — equipo seleccionado', margin + 5, y + 16);
    doc.setTextColor(...C.zinc400);
    doc.text(`TecMM Zapopan · Semana del ${fmtShortDate(report.weekStart)}`, margin + 5, y + 21);
    doc.text(`Generado por ${report.generatedBy} · ${fmtDate(report.generatedAt)}`, margin + 5, y + 26);
  } else {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.zinc400);
    doc.text(`Equipo TecMM Zapopan · Semana del ${fmtShortDate(report.weekStart)}`, margin + 5, y + 18);
    doc.text(`Generado por ${report.generatedBy} · ${fmtDate(report.generatedAt)}`, margin + 5, y + 24);
  }
  y += 36;

  // Cards resumen
  const cards = [
    { label: 'Integrantes', value: `${report.totalActiveMembers}`, sub: 'con disponibilidad' },
    { label: 'Horas totales', value: `${report.teamTotalHours}h`, sub: 'del grupo' },
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

  // Cobertura por día
  doc.setFillColor(...C.zinc800);
  doc.roundedRect(margin, y, pageW - margin * 2, 30, 2, 2, 'F');
  doc.setTextColor(...C.white);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Personas disponibles por día', margin + 4, y + 7);

  const activeDays = DAY_ORDER.filter((d) => d in report.coverageByDay);
  if (activeDays.length > 0) {
    const maxCov = Math.max(...Object.values(report.coverageByDay));
    const barAreaW = pageW - margin * 2 - 8;
    const barSlot = barAreaW / 7;
    DAY_ORDER.forEach((day, i) => {
      const count = report.coverageByDay[day] || 0;
      const bx = margin + 4 + i * barSlot;
      const barH = maxCov > 0 ? Math.round((count / maxCov) * 12) : 0;
      if (count > 0) {
        doc.setFillColor(...C.emerald);
        doc.roundedRect(bx, y + 22 - barH, barSlot - 2, barH, 1, 1, 'F');
        doc.setTextColor(...C.emerald);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text(String(count), bx, y + 22 - barH - 1);
      }
      doc.setTextColor(...C.zinc400);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text(day, bx, y + 27);
    });
  } else {
    doc.setTextColor(...C.zinc400);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Sin datos de disponibilidad', margin + 4, y + 18);
  }
  y += 36;

  // Tabla con fotos
  doc.setTextColor(...C.white);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Disponibilidad por integrante', margin, y + 5);
  y += 8;

  const avatarColW = 14;
  const cols = [avatarColW, 44, 20, 20, 22, 28, 28] as const;
  const headers = ['', 'Nombre', 'Horas', 'Bloques', 'Días', 'Desde', 'Hasta'];
  let cx = margin;
  doc.setFillColor(...C.zinc700);
  doc.rect(margin, y, pageW - margin * 2, 7, 'F');
  headers.forEach((h, i) => {
    if (h) {
      doc.setTextColor(...C.zinc100);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text(h, cx + 2, y + 5);
    }
    cx += cols[i];
  });
  y += 8;

  const toBase64 = async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) return null;
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch { return null; }
  };

  const drawInitialAvatar = (name: string, ax: number, ay: number, r: number) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const colors: [number, number, number][] = [
      [52, 211, 153], [251, 146, 60], [147, 51, 234],
      [59, 130, 246], [236, 72, 153], [234, 179, 8],
    ];
    const color = colors[Math.abs(hash) % colors.length];
    doc.setFillColor(...color);
    doc.circle(ax, ay, r, 'F');
    doc.setTextColor(...C.bg);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text(name.charAt(0).toUpperCase(), ax, ay + 2, { align: 'center' });
  };

  const drawCircularPhoto = (base64: string, ax: number, ay: number, r: number): Promise<void> =>
    new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const size = r * 2 * 10;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, 0, 0, size, size);
        try { doc.addImage(canvas.toDataURL('image/jpeg', 0.85), 'JPEG', ax - r, ay - r, r * 2, r * 2); }
        catch { /* silencioso */ }
        resolve();
      };
      img.onerror = () => resolve();
      img.src = base64;
    });

  const rowH = 11;
  for (let idx = 0; idx < report.members.length; idx++) {
    const m = report.members[idx];
    if (idx % 2 === 0) {
      doc.setFillColor(18, 18, 20);
      doc.rect(margin, y, pageW - margin * 2, rowH, 'F');
    }
    const midY = y + rowH / 2;
    const avatarR = 3.5;
    const avatarX = margin + avatarColW / 2;

    if (m.avatar_url) {
      const b64 = await toBase64(m.avatar_url);
      if (b64) await drawCircularPhoto(b64, avatarX, midY, avatarR);
      else drawInitialAvatar(m.full_name, avatarX, midY, avatarR);
    } else {
      drawInitialAvatar(m.full_name, avatarX, midY, avatarR);
    }

    const isActive = m.totalSlots > 0;
    doc.setTextColor(...(isActive ? C.zinc100 : C.zinc400));
    doc.setFontSize(7.5);
    doc.setFont('helvetica', isActive ? 'normal' : 'italic');

    const rowData = [
      '', m.full_name + (m.role === 'admin' ? ' ★' : ''),
      isActive ? `${m.totalHours}h` : '—',
      isActive ? String(m.totalSlots) : '—',
      isActive ? m.days.join(', ') : '—',
      m.earliestStart, m.latestEnd,
    ];
    cx = margin;
    rowData.forEach((val, i) => {
      if (val) doc.text(val, cx + 2, midY + 2.5);
      cx += cols[i];
    });
    if (isActive) {
      doc.setFillColor(...C.emerald);
      doc.circle(pageW - margin - 2, midY, 1.2, 'F');
    }
    y += rowH;
  }

  // ── Helper para dibujar un bloque de texto con título ────────────────────────
  const drawTextBox = (title: string, content: string, iconChar: string) => {
    if (!content) return;
    y += 6;
    const boxW = pageW - margin * 2;

    // Wrap text para que quepa dentro del recuadro
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(content, boxW - 10);
    const textH = lines.length * 4.5;
    const boxH = textH + 14;

    doc.setFillColor(...C.zinc800);
    doc.roundedRect(margin, y, boxW, boxH, 2, 2, 'F');

    // Franja de título
    doc.setFillColor(...C.zinc700);
    doc.roundedRect(margin, y, boxW, 8, 2, 2, 'F');
    // esquinas inferiores planas en la franja
    doc.setFillColor(...C.zinc700);
    doc.rect(margin, y + 4, boxW, 4, 'F');

    doc.setTextColor(...C.white);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`${iconChar}  ${title}`, margin + 4, y + 5.5);

    doc.setTextColor(...C.zinc100);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(lines, margin + 5, y + 13);

    y += boxH;
  };

  // Sección Actividades realizadas
  drawTextBox('Actividades realizadas', report.activities, '✦');

  // Sección Notas del ingeniero
  drawTextBox('Notas del ingeniero', report.engineerNotes, '✎');

  // Pie
  y += 6;
  doc.setDrawColor(...C.zinc700);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  doc.setTextColor(...C.zinc400);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Coordinación TecMM Zapopan · ${fmtDate(report.generatedAt)}`, pageW / 2, y, { align: 'center' });
  doc.text(`Reporte generado por ${report.generatedBy}${report.isPartial ? ' · Reporte parcial' : ''}`, pageW / 2, y + 4, { align: 'center' });

  const fileName = `${report.reportTitle.replace(/\s+/g, '-').toLowerCase()}-${fmtShortDate(report.generatedAt).replace(/\//g, '-')}.pdf`;
  doc.save(fileName);
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function ReportPanel() {
  const [step, setStep] = useState<'configure' | 'report'>('configure');
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reportTitle, setReportTitle] = useState('Reporte Semanal');
  const [activities, setActivities] = useState('');
  const [engineerNotes, setEngineerNotes] = useState('');
  const [report, setReport] = useState<WeeklyReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar lista de miembros al montar
  useEffect(() => {
    getTeamMemberOptions()
      .then((members) => {
        setTeamMembers(members);
        // Seleccionar todos por defecto
        setSelectedIds(new Set(members.map((m) => m.id)));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingMembers(false));
  }, []);

  const toggleMember = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(teamMembers.map((m) => m.id)));
  const clearAll = () => setSelectedIds(new Set());
  const isAllSelected = selectedIds.size === teamMembers.length;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const ids = [...selectedIds];
      const isPartial = ids.length < teamMembers.length;
      const data = await generateWeeklyReport(
        isPartial ? ids : undefined,
        reportTitle,
        activities,
        engineerNotes,
      );
      setReport(data);
      setStep('report');
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

      {/* ── PASO 1: Configurar ── */}
      {step === 'configure' && (
        <>
          {/* Título */}
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-zinc-800/80">
              <FileText className="w-4 h-4 text-zinc-300" />
              <h2 className="text-base font-semibold text-white">Nuevo Reporte</h2>
            </div>

            {/* Campo de título */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Pencil className="w-3.5 h-3.5 text-zinc-400" />
                Título del reporte
              </label>
              <input
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                placeholder="Ej. Sprint 3 · Módulo de login"
                className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-xl focus:border-zinc-500 outline-none text-zinc-100 placeholder:text-zinc-600"
              />
            </div>

            {/* Actividades realizadas */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                ✦ Actividades realizadas
              </label>
              <textarea
                value={activities}
                onChange={(e) => setActivities(e.target.value)}
                placeholder="Describe qué se trabajó esta semana. Ej: Se implementó el módulo de autenticación, se corrigieron 3 bugs del API de horarios, se documentó el flujo de presencia..."
                rows={4}
                className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-xl focus:border-zinc-500 outline-none text-zinc-100 placeholder:text-zinc-600 resize-none leading-relaxed"
              />
            </div>

            {/* Notas del ingeniero */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                ✎ Notas del ingeniero
              </label>
              <textarea
                value={engineerNotes}
                onChange={(e) => setEngineerNotes(e.target.value)}
                placeholder="Pendientes, continuación, observaciones técnicas. Ej: Falta integrar pruebas unitarias del módulo X. El endpoint /api/rides requiere revisión de rendimiento. Continuar desde la rama feature/carpooling..."
                rows={4}
                className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-xl focus:border-zinc-500 outline-none text-zinc-100 placeholder:text-zinc-600 resize-none leading-relaxed"
              />
            </div>
          </div>

          {/* Seleccionar miembros */}
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/80">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-zinc-400" />
                <h3 className="text-sm font-semibold text-white">
                  Integrantes del reporte
                </h3>
                <span className="text-[11px] text-zinc-500">
                  ({selectedIds.size} de {teamMembers.length})
                </span>
              </div>
              <button
                onClick={isAllSelected ? clearAll : selectAll}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {isAllSelected ? 'Quitar todos' : 'Seleccionar todos'}
              </button>
            </div>

            {loadingMembers ? (
              <div className="py-8 text-center text-xs text-zinc-500">Cargando equipo...</div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {teamMembers.map((m) => {
                  const checked = selectedIds.has(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMember(m.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        checked ? 'bg-zinc-900/40' : 'hover:bg-zinc-900/20 opacity-50'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className="flex-shrink-0 text-emerald-400">
                        {checked
                          ? <CheckSquare className="w-4 h-4" />
                          : <Square className="w-4 h-4 text-zinc-600" />}
                      </div>

                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold">
                        {m.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.avatar_url} alt={m.full_name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-zinc-300">{m.full_name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>

                      {/* Nombre */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-zinc-100 truncate">{m.full_name}</span>
                          {m.role === 'admin' && (
                            <span className="text-[9px] text-zinc-500 border border-zinc-700 px-1 rounded flex-shrink-0">Admin</span>
                          )}
                        </div>
                      </div>

                      {/* Indicador seleccionado */}
                      {checked && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Botón generar */}
          <button
            onClick={handleGenerate}
            disabled={loading || selectedIds.size === 0}
            className="w-full py-3 rounded-2xl bg-white hover:bg-zinc-100 text-zinc-950 text-sm font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Generando...</>
            ) : (
              <><FileText className="w-4 h-4" /> Generar Reporte ({selectedIds.size} {selectedIds.size === 1 ? 'persona' : 'personas'})</>
            )}
          </button>
        </>
      )}

      {/* ── PASO 2: Ver reporte ── */}
      {step === 'report' && report && (
        <>
          {/* Barra de acciones */}
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-zinc-300" />
                <div>
                  <h2 className="text-sm font-semibold text-white">{report.reportTitle}</h2>
                  {report.isPartial && (
                    <span className="text-[10px] text-amber-400">Reporte parcial · {report.members.length} integrantes</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setStep('configure'); setReport(null); setError(null); }}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-all"
                >
                  ← Editar
                </button>
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold transition-all disabled:opacity-50"
                >
                  {downloading
                    ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    : <Download className="w-3.5 h-3.5" />}
                  Descargar PDF
                </button>
              </div>
            </div>
          </div>

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

          {/* Cards resumen */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-3.5 flex flex-col gap-1">
              <Users className="w-4 h-4 text-emerald-400" />
              <span className="text-xl font-bold text-white">{report.totalActiveMembers}</span>
              <span className="text-[11px] text-zinc-400 leading-tight">Con disponibilidad</span>
            </div>
            <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-3.5 flex flex-col gap-1">
              <Clock className="w-4 h-4 text-zinc-300" />
              <span className="text-xl font-bold text-white">{report.teamTotalHours}h</span>
              <span className="text-[11px] text-zinc-400 leading-tight">Horas del grupo</span>
            </div>
            <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-3.5 flex flex-col gap-1">
              <TrendingUp className="w-4 h-4 text-zinc-300" />
              <span className="text-xl font-bold text-white">{report.mostActiveDay}</span>
              <span className="text-[11px] text-zinc-400 leading-tight">Día más activo</span>
            </div>
          </div>

          {/* Actividades realizadas */}
          {report.activities && (
            <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800/60 border-b border-zinc-700/60">
                <span className="text-zinc-300 text-sm">✦</span>
                <h3 className="text-xs font-semibold text-zinc-200">Actividades realizadas</h3>
              </div>
              <p className="px-4 py-3 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {report.activities}
              </p>
            </div>
          )}

          {/* Notas del ingeniero */}
          {report.engineerNotes && (
            <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800/60 border-b border-zinc-700/60">
                <span className="text-zinc-300 text-sm">✎</span>
                <h3 className="text-xs font-semibold text-zinc-200">Notas del ingeniero</h3>
              </div>
              <p className="px-4 py-3 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {report.engineerNotes}
              </p>
            </div>
          )}

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
                    <span className="text-[10px] font-semibold text-emerald-400">{count > 0 ? count : ''}</span>
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${Math.max(pct * 52, count > 0 ? 4 : 0)}px`,
                        backgroundColor: count > 0 ? '#34d399' : '#27272a',
                        opacity: count > 0 ? 0.7 + pct * 0.3 : 1,
                      }}
                    />
                    <span className="text-[10px] text-zinc-500">{day}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabla miembros */}
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
                      <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold">
                        {m.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.avatar_url} alt={m.full_name} className="w-full h-full object-cover" />
                        ) : (
                          <span className={active ? 'text-emerald-400' : 'text-zinc-500'}>
                            {m.full_name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-zinc-100 truncate">{m.full_name}</span>
                          {m.role === 'admin' && (
                            <span className="text-[9px] text-zinc-500 border border-zinc-700 px-1 rounded flex-shrink-0">Admin</span>
                          )}
                        </div>
                        {active ? (
                          <div className="text-[10px] text-zinc-500 mt-0.5">
                            {m.days.join(' · ')} · {m.earliestStart}–{m.latestEnd}
                          </div>
                        ) : (
                          <div className="text-[10px] text-zinc-600 italic mt-0.5">Sin disponibilidad esta semana</div>
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

          {/* Error descarga */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}
