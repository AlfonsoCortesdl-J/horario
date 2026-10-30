'use client';

import { useState, useEffect } from 'react';
import {
  SessionReport,
  TeamMemberAvailabilityForDate,
  getMexicoCityToday,
  getTeamAvailabilityForDate,
  getSessionReports,
  saveSessionReport,
} from '@/app/actions/report';
import {
  FileText,
  Download,
  RefreshCw,
  Users,
  Clock,
  Calendar,
  AlertCircle,
  Plus,
  ArrowLeft,
  Lock,
  Unlock,
  CheckCircle2,
  Square,
  CheckSquare,
  Pencil,
  Save,
  Info,
} from 'lucide-react';

function fmtDateVerbose(dateStr: string) {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  return dateObj.toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function fmtTimestamp(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function downloadSessionPDF(report: SessionReport) {
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

  // Fondo oscuro
  doc.setFillColor(...C.bg);
  doc.rect(0, 0, pageW, 297, 'F');

  // Encabezado
  doc.setFillColor(...C.zinc800);
  doc.roundedRect(margin, y, pageW - margin * 2, 30, 3, 3, 'F');

  doc.setTextColor(...C.white);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(report.title, margin + 5, y + 10);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.emerald);
  doc.text(`Fecha de sesión: ${fmtDateVerbose(report.session_date)}`, margin + 5, y + 17);

  doc.setTextColor(...C.zinc400);
  doc.text(
    `Registrado por ${report.author_name} · Registrado el ${fmtTimestamp(report.created_at)}`,
    margin + 5,
    y + 24
  );
  y += 36;

  // Tarjetas resumen
  const cardW = (pageW - margin * 2 - 8) / 2;
  const cards = [
    { label: 'Integrantes en sesión', value: `${report.members.length} personas`, sub: 'colaboradores presentes' },
    { label: 'Horas totales acumuladas', value: `${report.total_hours}h`, sub: 'según horario registrado' },
  ];

  cards.forEach((c, i) => {
    const cx = margin + i * (cardW + 8);
    doc.setFillColor(...C.zinc800);
    doc.roundedRect(cx, y, cardW, 20, 2, 2, 'F');
    doc.setTextColor(...C.emerald);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(c.value, cx + 4, y + 10);
    doc.setTextColor(...C.zinc400);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(c.label, cx + 4, y + 15);
  });
  y += 26;

  // Helper para cajas de texto descriptivas
  const drawTextBox = (title: string, content: string, iconChar: string) => {
    if (!content) return;
    const boxW = pageW - margin * 2;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(content, boxW - 10);
    const textH = lines.length * 4.5;
    const boxH = textH + 14;

    doc.setFillColor(...C.zinc800);
    doc.roundedRect(margin, y, boxW, boxH, 2, 2, 'F');

    // Barra de título
    doc.setFillColor(...C.zinc700);
    doc.roundedRect(margin, y, boxW, 8, 2, 2, 'F');
    doc.rect(margin, y + 4, boxW, 4, 'F');

    doc.setTextColor(...C.white);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`${iconChar}  ${title}`, margin + 4, y + 5.5);

    doc.setTextColor(...C.zinc100);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(lines, margin + 5, y + 13);

    y += boxH + 6;
  };

  drawTextBox('Actividades realizadas en la sesión', report.activities, '✦');
  drawTextBox('Notas del ingeniero (Continuación y pendientes)', report.engineer_notes, '✎');

  // Tabla de Integrantes
  doc.setTextColor(...C.white);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Integrantes participantes y horas registradas', margin, y + 4);
  y += 7;

  const avatarColW = 14;
  const cols = [avatarColW, 70, 50, 48] as const;
  const headers = ['', 'Nombre', 'Horario según registro', 'Horas'];
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

    doc.setTextColor(...C.zinc100);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');

    const rowData = [
      '',
      m.full_name + (m.role === 'admin' ? ' ★' : ''),
      m.time_range,
      m.hours > 0 ? `${m.hours} hrs` : '0 hrs',
    ];

    cx = margin;
    rowData.forEach((val, i) => {
      if (val) doc.text(val, cx + 2, midY + 2.5);
      cx += cols[i];
    });

    y += rowH;
  }

  // Pie de página
  y += 8;
  doc.setDrawColor(...C.zinc700);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  doc.setTextColor(...C.zinc400);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Coordinación TecMM Zapopan · Reporte Oficial de Sesión`, pageW / 2, y, { align: 'center' });
  doc.text(`Registrado por ${report.author_name} el ${fmtTimestamp(report.created_at)}`, pageW / 2, y + 4, { align: 'center' });

  const fileName = `sesion-${report.session_date}-${report.title.replace(/\s+/g, '-').toLowerCase()}.pdf`;
  doc.save(fileName);
}

export default function ReportPanel() {
  const [viewMode, setViewMode] = useState<'history' | 'view' | 'form'>('history');
  const [reports, setReports] = useState<SessionReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<SessionReport | null>(null);
  const [loadingReports, setLoadingReports] = useState(true);

  // Estados del Formulario (Crear / Editar)
  const [todayStr, setTodayStr] = useState('');
  const [formId, setFormId] = useState<string | undefined>(undefined);
  const [formDate, setFormDate] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formActivities, setFormActivities] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [teamAvailability, setTeamAvailability] = useState<TeamMemberAvailabilityForDate[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [savingForm, setSavingForm] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cargar lista de reportes y fecha de hoy en MX
  const refreshReportsList = async () => {
    setLoadingReports(true);
    try {
      const [all, today] = await Promise.all([
        getSessionReports(),
        getMexicoCityToday(),
      ]);
      setReports(all);
      setTodayStr(today);
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : 'Error al cargar reportes');
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    refreshReportsList();
  }, []);

  // Cargar disponibilidad del equipo cuando cambia la fecha del formulario
  useEffect(() => {
    if (!formDate) return;
    setLoadingAvailability(true);
    getTeamAvailabilityForDate(formDate)
      .then((members) => {
        setTeamAvailability(members);
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        setLoadingAvailability(false);
      });
  }, [formDate]);

  // Iniciar creación de un nuevo reporte para hoy
  const handleStartNewReport = () => {
    setFormId(undefined);
    setFormDate(todayStr);
    setFormTitle('Sesión de trabajo');
    setFormActivities('');
    setFormNotes('');
    setSelectedMemberIds(new Set());
    setErrorMessage(null);
    setViewMode('form');
  };

  // Iniciar edición de un reporte existente (solo permitido si es hoy)
  const handleStartEditReport = (r: SessionReport) => {
    if (!r.is_editable) {
      alert('Este reporte corresponde a una fecha anterior y está bloqueado contra edición. Solo lectura.');
      return;
    }
    setFormId(r.id);
    setFormDate(r.session_date);
    setFormTitle(r.title);
    setFormActivities(r.activities);
    setFormNotes(r.engineer_notes);
    setSelectedMemberIds(new Set(r.members.map((m) => m.id)));
    setErrorMessage(null);
    setViewMode('form');
  };

  // Ver un reporte
  const handleSelectReport = (r: SessionReport) => {
    setSelectedReport(r);
    setViewMode('view');
  };

  const toggleMemberCheckbox = (id: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllMembers = () => {
    setSelectedMemberIds(new Set(teamAvailability.map((m) => m.id)));
  };

  const handleClearAllMembers = () => {
    setSelectedMemberIds(new Set());
  };

  // Guardar formulario
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMemberIds.size === 0) {
      alert('Selecciona al menos a 1 integrante que haya participado en la sesión.');
      return;
    }

    setSavingForm(true);
    setErrorMessage(null);
    try {
      const res = await saveSessionReport({
        id: formId,
        title: formTitle,
        session_date: formDate,
        activities: formActivities,
        engineer_notes: formNotes,
        selected_member_ids: [...selectedMemberIds],
      });

      await refreshReportsList();

      // Buscar el reporte actualizado y mostrarlo en vista
      const all = await getSessionReports();
      const updated = all.find((item) => item.id === res.reportId);
      if (updated) {
        setSelectedReport(updated);
        setViewMode('view');
      } else {
        setViewMode('history');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al guardar reporte');
    } finally {
      setSavingForm(false);
    }
  };

  // Descarga PDF
  const handleDownloadPdf = async (rep: SessionReport) => {
    setDownloadingPdf(true);
    try {
      await downloadSessionPDF(rep);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al generar PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Cálculo de horas en vivo en el formulario
  const formCalculatedHours = teamAvailability
    .filter((m) => selectedMemberIds.has(m.id))
    .reduce((sum, m) => sum + m.hours, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-24 text-zinc-100">

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* MODO 1: HISTORIAL DE REPORTES                                          */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {viewMode === 'history' && (
        <div className="space-y-4">
          {/* Header con botón para nueva sesión */}
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                Reportes por Sesión
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Bitácoras de trabajo por jornada. Se pueden editar solo el mismo día; después quedan archivadas en solo lectura.
              </p>
            </div>
            <button
              type="button"
              onClick={handleStartNewReport}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold transition-all shadow-sm flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva Sesión de Hoy
            </button>
          </div>

          {/* Lista de reportes guardados */}
          {loadingReports ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-zinc-900/50 border border-zinc-800/60 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3">
              <Calendar className="w-10 h-10 text-zinc-600" />
              <div className="text-sm font-medium text-zinc-300">No hay sesiones registradas aún</div>
              <p className="text-xs text-zinc-500 max-w-sm">
                Crea el primer reporte de la jornada seleccionando quiénes asistieron hoy y redactando las actividades realizadas.
              </p>
              <button
                type="button"
                onClick={handleStartNewReport}
                className="mt-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold"
              >
                Comenzar reporte de hoy
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => {
                return (
                  <div
                    key={r.id}
                    onClick={() => handleSelectReport(r)}
                    className="bg-zinc-900/70 border border-zinc-800/80 hover:border-zinc-700 rounded-2xl p-4 cursor-pointer transition-all hover:bg-zinc-900 group space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">
                            {r.title}
                          </h3>
                          {r.is_editable ? (
                            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-800/60">
                              <Unlock className="w-2.5 h-2.5" /> Editable hoy
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                              <Lock className="w-2.5 h-2.5" /> Solo lectura
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 mt-1 capitalize">
                          {fmtDateVerbose(r.session_date)}
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span className="text-sm font-bold text-white">{r.total_hours}h</span>
                        <div className="text-[10px] text-zinc-500">{r.members.length} integrantes</div>
                      </div>
                    </div>

                    {/* Preview de actividades */}
                    {r.activities && (
                      <p className="text-xs text-zinc-400 line-clamp-2 bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-800/60 font-sans">
                        {r.activities}
                      </p>
                    )}

                    {/* Pie de tarjeta */}
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-zinc-800/50">
                      <span>Registrado por <span className="text-zinc-300 font-medium">{r.author_name}</span></span>
                      <span className="text-zinc-600">Ver detalles →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* MODO 2: DETALLE Y VISUALIZACIÓN DE UNA SESIÓN                          */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {viewMode === 'view' && selectedReport && (
        <div className="space-y-4">
          {/* Barra superior de acciones */}
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setViewMode('history')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Historial
            </button>

            <div className="flex items-center gap-2">
              {selectedReport.is_editable && (
                <button
                  type="button"
                  onClick={() => handleStartEditReport(selectedReport)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-all"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar
                </button>
              )}

              <button
                type="button"
                disabled={downloadingPdf}
                onClick={() => handleDownloadPdf(selectedReport)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold transition-all disabled:opacity-50"
              >
                {downloadingPdf ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                Descargar PDF
              </button>
            </div>
          </div>

          {/* Banner de estado de edición */}
          <div className={`p-3 rounded-2xl border flex items-center gap-2.5 text-xs ${
            selectedReport.is_editable
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
              : 'bg-zinc-900/80 border-zinc-800/80 text-zinc-400'
          }`}>
            {selectedReport.is_editable ? (
              <>
                <Unlock className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                <span>Sesión de hoy activa. Puedes editar los integrantes, actividades y notas durante el día de hoy.</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 flex-shrink-0 text-zinc-500" />
                <span>Sesión archivada de fecha anterior. Protegida contra modificaciones (Solo lectura y descarga de PDF).</span>
              </>
            )}
          </div>

          {/* Encabezado del reporte */}
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <div>
              <h2 className="text-lg font-bold text-white">{selectedReport.title}</h2>
              <p className="text-xs text-zinc-400 capitalize mt-0.5">
                {fmtDateVerbose(selectedReport.session_date)}
              </p>
            </div>

            <div className="text-xs text-zinc-500 flex items-center gap-1.5 pt-2 border-t border-zinc-800/60">
              <span>Registrado por <strong className="text-zinc-300">{selectedReport.author_name}</strong></span>
              <span>·</span>
              <span>{fmtTimestamp(selectedReport.created_at)}</span>
            </div>
          </div>

          {/* Métricas clave */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4 flex flex-col gap-1">
              <Users className="w-4 h-4 text-emerald-400" />
              <span className="text-2xl font-bold text-white">{selectedReport.members.length}</span>
              <span className="text-xs text-zinc-400">Integrantes participantes</span>
            </div>
            <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4 flex flex-col gap-1">
              <Clock className="w-4 h-4 text-zinc-300" />
              <span className="text-2xl font-bold text-white">{selectedReport.total_hours}h</span>
              <span className="text-xs text-zinc-400">Horas acumuladas según horario</span>
            </div>
          </div>

          {/* Recuadro: Actividades Realizadas */}
          {selectedReport.activities && (
            <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800/60 border-b border-zinc-700/60">
                <span className="text-emerald-400 text-sm">✦</span>
                <h3 className="text-xs font-semibold text-zinc-200">Actividades realizadas en la sesión</h3>
              </div>
              <p className="px-4 py-3.5 text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap font-sans">
                {selectedReport.activities}
              </p>
            </div>
          )}

          {/* Recuadro: Notas del Ingeniero */}
          {selectedReport.engineer_notes && (
            <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800/60 border-b border-zinc-700/60">
                <span className="text-amber-400 text-sm">✎</span>
                <h3 className="text-xs font-semibold text-zinc-200">Notas del ingeniero (Continuación y pendientes)</h3>
              </div>
              <p className="px-4 py-3.5 text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap font-sans">
                {selectedReport.engineer_notes}
              </p>
            </div>
          )}

          {/* Tabla de Integrantes */}
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-zinc-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-zinc-400" />
                <h3 className="text-xs font-semibold text-white">Integrantes y horas según su horario</h3>
              </div>
              <span className="text-[11px] text-zinc-500">{selectedReport.members.length} colaboradores</span>
            </div>

            <div className="divide-y divide-zinc-800/50">
              {selectedReport.members.map((m) => (
                <div key={m.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
                      {m.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.avatar_url} alt={m.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{m.full_name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-zinc-100 truncate">{m.full_name}</span>
                        {m.role === 'admin' && (
                          <span className="text-[9px] text-zinc-500 border border-zinc-700 px-1 rounded flex-shrink-0">Admin</span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        {m.time_range}
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-sm font-bold text-white">{m.hours}h</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* MODO 3: FORMULARIO CREAR / EDITAR SESIÓN                              */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {viewMode === 'form' && (
        <form onSubmit={handleSubmitForm} className="space-y-4">
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <h2 className="text-base font-semibold text-white">
                  {formId ? 'Editar Reporte de Sesión' : 'Nueva Sesión de Trabajo'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setViewMode(selectedReport ? 'view' : 'history')}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
            </div>

            {/* Error si ocurre */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Fecha de la sesión */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Fecha de la sesión
                </label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-xl focus:border-zinc-500 outline-none text-zinc-100"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  {formDate === todayStr ? '🟢 Fecha de hoy (podrás editarla hoy)' : '⚠️ Fecha distinta a hoy'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Título de la jornada o sesión
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Avance en suspensión y corte"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-xl focus:border-zinc-500 outline-none text-zinc-100 placeholder:text-zinc-600"
                />
              </div>
            </div>

            {/* Actividades realizadas */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1.5">
                <span className="text-emerald-400">✦</span>
                Actividades realizadas en esta sesión
              </label>
              <textarea
                required
                rows={4}
                value={formActivities}
                onChange={(e) => setFormActivities(e.target.value)}
                placeholder="Describe qué se hizo en conjunto durante esta sesión de trabajo..."
                className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-xl focus:border-zinc-500 outline-none text-zinc-100 placeholder:text-zinc-600 resize-none leading-relaxed"
              />
            </div>

            {/* Notas del ingeniero */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1.5">
                <span className="text-amber-400">✎</span>
                Notas del ingeniero (Continuación y pendientes)
              </label>
              <textarea
                rows={4}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Indica qué quedó pendiente, en qué punto se va a continuar la siguiente sesión o si hubo algún imprevisto técnico..."
                className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-xl focus:border-zinc-500 outline-none text-zinc-100 placeholder:text-zinc-600 resize-none leading-relaxed"
              />
            </div>
          </div>

          {/* Selector de integrantes con horas automáticas según su horario */}
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-zinc-800/80 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-zinc-400" />
                  Integrantes presentes en esta sesión
                </h3>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  Las horas se toman automáticamente del horario de cada persona para este día.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectedMemberIds.size === teamAvailability.length ? handleClearAllMembers : handleSelectAllMembers}
                  className="text-[11px] text-zinc-400 hover:text-white"
                >
                  {selectedMemberIds.size === teamAvailability.length ? 'Quitar todos' : 'Todos'}
                </button>
              </div>
            </div>

            {loadingAvailability ? (
              <div className="p-8 text-center text-xs text-zinc-500">Calculando horarios del día...</div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {teamAvailability.map((m) => {
                  const isChecked = selectedMemberIds.has(m.id);
                  return (
                    <div
                      key={m.id}
                      onClick={() => toggleMemberCheckbox(m.id)}
                      className={`px-4 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isChecked ? 'bg-zinc-900/80' : 'opacity-50 hover:opacity-80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="text-emerald-400 flex-shrink-0">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4 text-zinc-600" />
                          )}
                        </div>

                        <div className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
                          {m.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.avatar_url} alt={m.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{m.full_name.charAt(0).toUpperCase()}</span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-zinc-100 truncate block">
                            {m.full_name}
                          </span>
                          <span className="text-[10px] text-zinc-500 block truncate">
                            {m.time_range}
                          </span>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span className={`text-xs font-bold ${m.hours > 0 ? 'text-emerald-400' : 'text-zinc-500'}`}>
                          {m.hours > 0 ? `${m.hours}h` : '0h'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Barra de total seleccionado */}
            <div className="p-3 bg-zinc-950/80 border-t border-zinc-800/80 flex items-center justify-between text-xs">
              <span className="text-zinc-400">
                Total acumulado en sesión: <strong className="text-white">{selectedMemberIds.size} integrantes</strong>
              </span>
              <span className="text-emerald-400 font-bold text-sm">
                {Math.round(formCalculatedHours * 10) / 10}h de trabajo
              </span>
            </div>
          </div>

          {/* Botón Guardar */}
          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMode(selectedReport ? 'view' : 'history')}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={savingForm || selectedMemberIds.size === 0}
              className="px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
            >
              {savingForm ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Guardar Reporte de Sesión
                </>
              )}
            </button>
          </div>
        </form>
      )}

    </div>
  );
}
