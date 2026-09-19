import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  FileSpreadsheet,
  Printer,
  Download,
  Search,
  ChevronDown,
  ChevronRight,
  Users,
  Phone,
  GraduationCap,
  RefreshCw,
  Maximize2,
  Minimize2,
  Calendar,
  X,
  Info
} from 'lucide-react';

function calcularEdad(fechaString) {
  if (!fechaString) return 0;
  const partes = fechaString.split('-');
  if (partes.length !== 3) return 0;
  const anio = parseInt(partes[0], 10);
  const mes = parseInt(partes[1], 10) - 1;
  const dia = parseInt(partes[2], 10);

  const hoy = new Date();
  let edad = hoy.getFullYear() - anio;
  const m = hoy.getMonth() - mes;
  if (m < 0 || (m === 0 && hoy.getDate() < dia)) {
    edad--;
  }
  return edad;
}

function formatearFechaCorta(fechaISO) {
  if (!fechaISO) return '';
  const partes = fechaISO.split('T')[0].split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0].slice(2)}`;
  }
  return fechaISO;
}

function formatearFechaCompleta(fechaISO) {
  if (!fechaISO) return '';
  const partes = fechaISO.split('T')[0].split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return fechaISO;
}

function extraerTicket(repInfo) {
  if (!repInfo) return null;
  const match = repInfo.match(/Ticket:\s*#?([0-9A-Za-z]+)/i);
  return match ? match[1] : null;
}

function extraerModoSalida(repInfo) {
  if (!repInfo) return 'Lo vienen a buscar';
  if (repInfo.toLowerCase().includes('se va solo')) return 'Se va solo/a';
  return 'Lo vienen a buscar';
}

function extraerParentesco(repInfo) {
  if (!repInfo) return 'Representante';
  const match = repInfo.match(/\((Padre|Madre|Abuelo\/a|T\u00edo\/a|Hermano\/a|Tutor Legal|Otro)/i);
  return match ? match[1] : 'Representante';
}

function limpiarNombreRep(repInfo) {
  if (!repInfo) return '';
  return repInfo
    .replace(/\([^)]*\)/g, '')
    .replace(/Ticket:\s*#?\w+/gi, '')
    .replace(/Salida:\s*[^)]+/gi, '')
    .trim();
}

export default function HojaExcelEstudiantes() {
  const [estudiantes, setEstudiantes] = useState([]);
  const [historialFechas, setHistorialFechas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroSalon, setFiltroSalon] = useState('todos');
  const [filtroGenero, setFiltroGenero] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filasExpandidas, setFilasExpandidas] = useState(new Set());
  const [modoVista, setModoVista] = useState('matriz'); // 'matriz' | 'desglosado'
  const [fechaImpresion, setFechaImpresion] = useState('');

  // Control Inteligente de Rango de Fechas para Pantalla e Impresión
  const [alcanceFechas, setAlcanceFechas] = useState('ultimas-4'); // 'ultimas-4' | 'ultimas-8' | 'fecha-especifica' | 'sin-fechas' | 'todas'
  const [fechaEspecifica, setFechaEspecifica] = useState('');
  const [mostrarModalImpresion, setMostrarModalImpresion] = useState(false);
  const [incluirFirmaEnImpresion, setIncluirFirmaEnImpresion] = useState(true);

  useEffect(() => {
    cargarDatos();
    const hoy = new Date();
    setFechaImpresion(hoy.toLocaleDateString('es-VE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }));
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      // 1. Obtener todos los estudiantes de la base de datos
      const { data: dataEstudiantes, error: errEst } = await supabase
        .from('estudiantes')
        .select('*')
        .order('nombre', { ascending: true });

      if (errEst) throw errEst;

      // 2. Obtener todo el historial de domingos
      const { data: dataHistorial, error: errHist } = await supabase
        .from('historial_domingos')
        .select('*')
        .order('fecha', { ascending: false });

      if (errHist) throw errHist;

      // Consolidar fechas únicas del historial
      const mapaFechas = {};
      (dataHistorial || []).forEach(h => {
        const fechaStr = h.fecha ? h.fecha.split('T')[0] : 'Sin fecha';
        if (!mapaFechas[fechaStr]) {
          mapaFechas[fechaStr] = {
            fecha: fechaStr,
            estudiantesMap: new Map()
          };
        }
        (h.estudiantes || []).forEach(e => {
          if (e.id) mapaFechas[fechaStr].estudiantesMap.set(`id:${e.id}`, e);
          const claveNombre = `${(e.nombre || '').trim().toLowerCase()}_${(e.apellido || '').trim().toLowerCase()}`;
          mapaFechas[fechaStr].estudiantesMap.set(`name:${claveNombre}`, e);
        });
      });

      // Ordenar fechas cronológicamente descendente
      const fechasArray = Object.values(mapaFechas).sort((a, b) => b.fecha.localeCompare(a.fecha));

      setEstudiantes(dataEstudiantes || []);
      setHistorialFechas(fechasArray);
      if (fechasArray.length > 0) {
        setFechaEspecifica(fechasArray[0].fecha);
      }
    } catch (err) {
      console.error('Error cargando datos para hoja de cálculo:', err);
      alert('Error al cargar datos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper para verificar asistencia de un estudiante en una fecha específica
  const verificarAsistencia = (estudiante, fechaObj) => {
    if (!fechaObj || !fechaObj.estudiantesMap) return null;
    
    if (estudiante.id && fechaObj.estudiantesMap.has(`id:${estudiante.id}`)) {
      return fechaObj.estudiantesMap.get(`id:${estudiante.id}`);
    }
    
    const claveNombre = `${(estudiante.nombre || '').trim().toLowerCase()}_${(estudiante.apellido || '').trim().toLowerCase()}`;
    if (fechaObj.estudiantesMap.has(`name:${claveNombre}`)) {
      return fechaObj.estudiantesMap.get(`name:${claveNombre}`);
    }

    return null;
  };

  // Fechas activas según el alcance seleccionado (evita saturación horizontal)
  const fechasSeleccionadas = useMemo(() => {
    if (alcanceFechas === 'ultimas-4') {
      return historialFechas.slice(0, 4);
    }
    if (alcanceFechas === 'ultimas-8') {
      return historialFechas.slice(0, 8);
    }
    if (alcanceFechas === 'fecha-especifica') {
      const encontrada = historialFechas.find(f => f.fecha === fechaEspecifica);
      return encontrada ? [encontrada] : historialFechas.slice(0, 1);
    }
    if (alcanceFechas === 'sin-fechas') {
      return [];
    }
    return historialFechas; // 'todas'
  }, [historialFechas, alcanceFechas, fechaEspecifica]);

  // Procesar estudiantes calculando asistencias por fecha
  const estudiantesProcesados = useMemo(() => {
    return estudiantes.map(est => {
      const edad = est.fecha_nacimiento ? calcularEdad(est.fecha_nacimiento) : (est.edad || 0);
      const repLimpio = limpiarNombreRep(est.nombre_representante);
      const parentesco = extraerParentesco(est.nombre_representante);
      const modoSalida = extraerModoSalida(est.nombre_representante);
      const ticketActual = extraerTicket(est.nombre_representante);

      // Evaluar asistencias en todas las fechas del historial
      const asistenciasPorFecha = {};
      let totalAsistencias = 0;

      historialFechas.forEach(f => {
        const registroAsist = verificarAsistencia(est, f);
        if (registroAsist) {
          asistenciasPorFecha[f.fecha] = {
            asistio: true,
            ticket: extraerTicket(registroAsist.nombre_representante),
            info: registroAsist
          };
          totalAsistencias++;
        } else {
          asistenciasPorFecha[f.fecha] = {
            asistio: false
          };
        }
      });

      const asistioHoy = Boolean(est.activo_este_domingo);

      const porcentajeAsistencia = historialFechas.length > 0 
        ? Math.round((totalAsistencias / historialFechas.length) * 100) 
        : (asistioHoy ? 100 : 0);

      return {
        ...est,
        edadCalculada: edad,
        repLimpio,
        parentesco,
        modoSalida,
        ticketActual,
        asistioHoy,
        asistenciasPorFecha,
        totalAsistencias,
        porcentajeAsistencia
      };
    });
  }, [estudiantes, historialFechas]);

  // Filtrado reactivo de estudiantes
  const estudiantesFiltrados = useMemo(() => {
    return estudiantesProcesados.filter(est => {
      // Filtro de búsqueda
      if (busqueda.trim()) {
        const term = busqueda.toLowerCase().trim();
        const nombreCompleto = `${est.nombre || ''} ${est.apellido || ''}`.toLowerCase();
        const rep = (est.nombre_representante || '').toLowerCase();
        const tel = (est.telefono_representante || '').toLowerCase();
        const ticket = (est.ticketActual || '').toLowerCase();
        const salon = (est.salon_actual || '').toLowerCase();

        const match = nombreCompleto.includes(term) ||
                      rep.includes(term) ||
                      tel.includes(term) ||
                      ticket.includes(term.replace('#', '')) ||
                      salon.includes(term);

        if (!match) return false;
      }

      // Filtro por Salón
      if (filtroSalon !== 'todos') {
        if (filtroSalon === 'Graduado') {
          if (est.salon_actual !== 'Graduado' && est.edadCalculada <= 12) return false;
        } else if (filtroSalon === 'Usos Múltiples') {
          if (est.salon_actual === 'Graduado' || est.edadCalculada > 12) return false;
        } else {
          if (est.salon_actual !== filtroSalon) return false;
        }
      }

      // Filtro por Género
      if (filtroGenero !== 'todos') {
        if (est.genero !== filtroGenero) return false;
      }

      // Filtro por Estado
      if (filtroEstado === 'activos_hoy') {
        if (!est.asistioHoy) return false;
      } else if (filtroEstado === 'graduados') {
        if (est.salon_actual !== 'Graduado' && est.edadCalculada <= 12) return false;
      } else if (filtroEstado === 'regulares') {
        if (est.salon_actual === 'Graduado' || est.edadCalculada > 12) return false;
      }

      // Si se filtró por una fecha específica y el usuario quiere ver solo los que asistieron en esa fecha:
      if (alcanceFechas === 'fecha-especifica' && filtroEstado === 'asistieron_esta_fecha') {
        const asist = est.asistenciasPorFecha[fechaEspecifica];
        if (!asist || !asist.asistio) return false;
      }

      return true;
    });
  }, [estudiantesProcesados, busqueda, filtroSalon, filtroGenero, filtroEstado, alcanceFechas, fechaEspecifica]);

  // Manejo de expansión de filas
  const toggleFila = (id) => {
    setFilasExpandidas(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) {
        nuevo.delete(id);
      } else {
        nuevo.add(id);
      }
      return nuevo;
    });
  };

  const expandirTodos = () => {
    const todosIds = new Set(estudiantesFiltrados.map(e => e.id));
    setFilasExpandidas(todosIds);
  };

  const contraerTodos = () => {
    setFilasExpandidas(new Set());
  };

  // Lanzar diálogo de impresión nativo
  const ejecutarImpresion = () => {
    setMostrarModalImpresion(false);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Exportar a Excel (CSV con UTF-8 BOM)
  const handleExportarExcel = () => {
    try {
      const headers = [
        'N°',
        'Nombre',
        'Apellido',
        'Género',
        'Fecha de Nacimiento',
        'Edad Actual',
        'Salón Actual',
        'Activo Hoy',
        'Ticket Actual',
        'Representante',
        'Parentesco',
        'Teléfono Representante',
        'Modo de Salida',
        'Fecha de Ingreso Sistema',
        'Total Asistencias Historial',
        '% Asistencia',
        ...historialFechas.map(f => `Asistencia ${formatearFechaCompleta(f.fecha)}`)
      ];

      const rows = estudiantesFiltrados.map((est, index) => {
        const filaFechas = historialFechas.map(f => {
          const asist = est.asistenciasPorFecha[f.fecha];
          if (asist && asist.asistio) {
            return asist.ticket ? `SÍ (#${asist.ticket})` : 'SÍ';
          }
          return 'NO';
        });

        return [
          index + 1,
          `"${(est.nombre || '').replace(/"/g, '""')}"`,
          `"${(est.apellido || '').replace(/"/g, '""')}"`,
          est.genero || 'No especificado',
          est.fecha_nacimiento || '',
          est.edadCalculada,
          `"${est.salon_actual || 'Usos Múltiples'}"`,
          est.asistioHoy ? 'SÍ' : 'NO',
          est.ticketActual ? `#${est.ticketActual}` : 'N/A',
          `"${(est.repLimpio || '').replace(/"/g, '""')}"`,
          est.parentesco,
          est.telefono_representante || '',
          `"${est.modoSalida}"`,
          est.created_at ? est.created_at.split('T')[0] : '',
          est.totalAsistencias,
          `${est.porcentajeAsistencia}%`,
          ...filaFechas
        ];
      });

      const csvContent = '\uFEFF' + [
        headers.join(';'),
        ...rows.map(r => r.join(';'))
      ].join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().split('T')[0];
      link.setAttribute('href', url);
      link.setAttribute('download', `Maranatha_Kids_Estudiantes_${timestamp}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exportando a Excel/CSV:', error);
      alert('Error al exportar archivo: ' + error.message);
    }
  };

  // Métricas rápidas
  const totalActivosHoy = estudiantesProcesados.filter(e => e.asistioHoy).length;
  const totalNinos = estudiantesFiltrados.filter(e => e.genero === 'Niño').length;
  const totalNinas = estudiantesFiltrados.filter(e => e.genero === 'Niña').length;

  // Texto descriptivo del alcance de fechas para el membrete impreso
  const textoAlcanceImpresion = useMemo(() => {
    if (alcanceFechas === 'ultimas-4') return 'Reporte Mensual (Últimas 4 semanas evaluadas)';
    if (alcanceFechas === 'ultimas-8') return 'Reporte Bimestral (Últimas 8 semanas evaluadas)';
    if (alcanceFechas === 'fecha-especifica') return `Control de Asistencia del Domingo ${formatearFechaCompleta(fechaEspecifica)}`;
    if (alcanceFechas === 'sin-fechas') return 'Directorio General de Estudiantes (Sin columnas de fechas)';
    return `Histórico General (${historialFechas.length} fechas registradas)`;
  }, [alcanceFechas, fechaEspecifica, historialFechas]);

  if (loading) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
        <RefreshCw className="animate-spin" size={32} color="var(--accent-primary)" style={{ margin: '0 auto 1rem' }} />
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Generando Hoja de Cálculo...</h3>
        <p style={{ color: 'var(--text-secondary)' }}>Cargando catálogo completo de estudiantes y matriz de asistencia.</p>
      </div>
    );
  }

  return (
    <div className="excel-page-wrapper" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      
      {/* ================= ENCABEZADO EXCLUSIVO PARA IMPRESIÓN ================= */}
      <div className="print-only-header">
        <div style={{ borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '16pt', color: '#000', fontWeight: 'bold' }}>
                Maranatha Kids — Planilla Oficial de Estudiantes y Asistencia
              </h1>
              <p style={{ margin: '3px 0 0', fontSize: '9pt', color: '#333', fontWeight: 600 }}>
                {textoAlcanceImpresion}
              </p>
            </div>
            <div style={{ textAlign: 'right', fontSize: '8pt', color: '#555' }}>
              <div>Fecha de Emisión: {fechaImpresion}</div>
              <div>Página de Control Administrativo</div>
            </div>
          </div>

          <div style={{ marginTop: '6px', fontSize: '8pt', color: '#222', display: 'flex', gap: '16px', flexWrap: 'wrap', borderTop: '1px dotted #ccc', paddingTop: '4px' }}>
            <span><strong>Total Estudiantes Listados:</strong> {estudiantesFiltrados.length}</span>
            <span><strong>Niños:</strong> {totalNinos}</span>
            <span><strong>Niñas:</strong> {totalNinas}</span>
            <span><strong>Activos Hoy:</strong> {totalActivosHoy}</span>
            <span><strong>Columnas de Fecha Impresas:</strong> {fechasSeleccionadas.length}</span>
          </div>
        </div>
      </div>

      {/* ================= BARRA SUPERIOR ESTILO EXCEL (PANTALLA) ================= */}
      <div className="glass-panel no-print" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              background: 'linear-gradient(135deg, #107c41, #1e9d5a)', 
              padding: '0.6rem', 
              borderRadius: '10px', 
              color: 'white',
              boxShadow: '0 4px 12px rgba(16, 124, 65, 0.4)'
            }}>
              <FileSpreadsheet size={26} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Planilla Tipo Excel de Estudiantes
              </h2>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Visualización tabular, desglose completo y matriz de asistencia con control de fechas
              </span>
            </div>
          </div>

          {/* Acciones Principales: Imprimir, Exportar, Recargar */}
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setMostrarModalImpresion(true)}
              className="btn-secondary"
              style={{
                background: 'rgba(59, 130, 246, 0.2)',
                border: '1.5px solid var(--accent-primary)',
                color: 'white',
                padding: '0.55rem 1.1rem',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: 700,
                fontSize: '0.9rem',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)'
              }}
              title="Abrir opciones de impresión optimizada para papel o PDF"
            >
              <Printer size={17} color="var(--accent-primary)" />
              Opciones de Impresión
            </button>

            <button
              onClick={handleExportarExcel}
              className="btn-secondary"
              style={{
                background: 'rgba(16, 124, 65, 0.2)',
                border: '1px solid #107c41',
                color: '#4ade80',
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontWeight: 600,
                fontSize: '0.9rem'
              }}
              title="Descargar archivo .CSV con todas las fechas compatible con Excel"
            >
              <Download size={16} />
              Exportar a Excel (.csv)
            </button>

            <button
              onClick={cargarDatos}
              style={{
                background: 'transparent',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-secondary)',
                padding: '0.55rem 0.8rem',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
              title="Actualizar datos"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* Resumen de Estadísticas Rápidas (Cintas Excel) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1rem'
        }}>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Registrados</span>
            <strong style={{ fontSize: '1.35rem', color: 'white' }}>{estudiantes.length}</strong>
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Listados Filtrados</span>
            <strong style={{ fontSize: '1.35rem', color: 'var(--accent-primary)' }}>{estudiantesFiltrados.length}</strong>
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Activos Hoy</span>
            <strong style={{ fontSize: '1.35rem', color: '#4ade80' }}>{totalActivosHoy}</strong>
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Domingos Registrados</span>
            <strong style={{ fontSize: '1.35rem', color: '#facc15' }}>{historialFechas.length}</strong>
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Género</span>
            <span style={{ fontSize: '0.95rem', color: 'white', fontWeight: 600, display: 'block', marginTop: '4px' }}>
              👦 {totalNinos} | 👧 {totalNinas}
            </span>
          </div>
        </div>

        {/* Barra de Filtros, Búsqueda y Rango de Fechas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            
            {/* Buscador Universal */}
            <div style={{ position: 'relative', flex: '1 1 260px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Buscar por estudiante, ticket, teléfono, representante..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                style={{
                  paddingLeft: '2.4rem',
                  paddingRight: busqueda ? '2.4rem' : '1rem',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                  color: 'white',
                  width: '100%',
                  fontSize: '0.9rem'
                }}
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda('')}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Selector de Alcance de Fechas en Pantalla (Protege de saturación) */}
            <div style={{ minWidth: '210px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '0.72rem', color: '#93c5fd', margin: 0, fontWeight: 600 }}>
                📅 Columnas de Domingo a Mostrar:
              </label>
              <select
                value={alcanceFechas}
                onChange={e => setAlcanceFechas(e.target.value)}
                style={{ padding: '0.55rem 0.8rem', fontSize: '0.85rem', borderColor: 'rgba(59, 130, 246, 0.4)' }}
              >
                <option value="ultimas-4">Últimas 4 semanas (1 mes) — Recomendado</option>
                <option value="ultimas-8">Últimas 8 semanas (2 meses)</option>
                <option value="fecha-especifica">Solo 1 domingo específico...</option>
                <option value="sin-fechas">Sin columnas de fechas (Solo directorio)</option>
                <option value="todas">Todas las fechas registradas ({historialFechas.length})</option>
              </select>
            </div>

            {/* Sub-selector si eligió fecha específica */}
            {alcanceFechas === 'fecha-especifica' && (
              <div style={{ minWidth: '170px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <label style={{ fontSize: '0.72rem', color: '#facc15', margin: 0, fontWeight: 600 }}>
                  Elegir Domingo:
                </label>
                <select
                  value={fechaEspecifica}
                  onChange={e => setFechaEspecifica(e.target.value)}
                  style={{ padding: '0.55rem 0.8rem', fontSize: '0.85rem', borderColor: '#facc15' }}
                >
                  {historialFechas.map(f => (
                    <option key={f.fecha} value={f.fecha}>
                      {formatearFechaCompleta(f.fecha)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Filtro Salón */}
            <div style={{ minWidth: '140px' }}>
              <select
                value={filtroSalon}
                onChange={e => setFiltroSalon(e.target.value)}
                style={{ padding: '0.65rem 0.8rem', fontSize: '0.85rem' }}
              >
                <option value="todos">Todos los salones</option>
                <option value="Usos Múltiples">Usos Múltiples (8-12)</option>
                <option value="Graduado">Graduados (&gt;12)</option>
              </select>
            </div>

            {/* Filtro Género */}
            <div style={{ minWidth: '110px' }}>
              <select
                value={filtroGenero}
                onChange={e => setFiltroGenero(e.target.value)}
                style={{ padding: '0.65rem 0.8rem', fontSize: '0.85rem' }}
              >
                <option value="todos">Géneros: Todos</option>
                <option value="Niño">Niños</option>
                <option value="Niña">Niñas</option>
              </select>
            </div>

            {/* Filtro Estado */}
            <div style={{ minWidth: '140px' }}>
              <select
                value={filtroEstado}
                onChange={e => setFiltroEstado(e.target.value)}
                style={{ padding: '0.65rem 0.8rem', fontSize: '0.85rem' }}
              >
                <option value="todos">Todos los estados</option>
                <option value="activos_hoy">Activos hoy</option>
                {alcanceFechas === 'fecha-especifica' && (
                  <option value="asistieron_esta_fecha">Asistieron esta fecha</option>
                )}
                <option value="regulares">Regulares</option>
                <option value="graduados">Graduados</option>
              </select>
            </div>

          </div>

          {/* Controles de Vista y Desglose Masivo */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.3rem' }}>
            
            {/* Alternador de Vista */}
            <div style={{ display: 'inline-flex', background: 'rgba(15, 23, 42, 0.8)', padding: '3px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
              <button
                onClick={() => setModoVista('matriz')}
                style={{
                  background: modoVista === 'matriz' ? 'var(--accent-gradient)' : 'transparent',
                  color: modoVista === 'matriz' ? 'white' : 'var(--text-secondary)',
                  border: 'none',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <FileSpreadsheet size={15} /> Matriz ({fechasSeleccionadas.length} domingos)
              </button>
              <button
                onClick={() => setModoVista('desglosado')}
                style={{
                  background: modoVista === 'desglosado' ? 'var(--accent-gradient)' : 'transparent',
                  color: modoVista === 'desglosado' ? 'white' : 'var(--text-secondary)',
                  border: 'none',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Users size={15} /> Fichas Desglosadas
              </button>
            </div>

            {/* Aviso amigable si hay muchas columnas en pantalla */}
            {fechasSeleccionadas.length > 8 && (
              <div style={{ fontSize: '0.78rem', color: '#fde047', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Info size={14} /> Tienes {fechasSeleccionadas.length} columnas. Para imprimir en papel recomendamos 4 u 8 semanas.
              </div>
            )}

            {/* Acciones de Desglose rápido */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={expandirTodos}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--glass-border)',
                  color: 'white',
                  padding: '0.35rem 0.7rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Desglosar datos de todos los estudiantes"
              >
                <Maximize2 size={13} /> Desglosar Todos
              </button>
              <button
                onClick={contraerTodos}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-secondary)',
                  padding: '0.35rem 0.7rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Contraer todos los desgloses"
              >
                <Minimize2 size={13} /> Contraer Todos
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* ================= CONTENIDO PRINCIPAL / TABLA EXCEL ================= */}
      {estudiantesFiltrados.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <Users size={40} color="var(--text-secondary)" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>No se encontraron estudiantes</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Intenta cambiar los términos de búsqueda o los filtros aplicados.
          </p>
        </div>
      ) : (
        <div className="excel-table-container glass-panel" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
          <div style={{ overflowX: 'auto', maxHeight: '72vh' }}>
            <table className="excel-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              
              {/* ENCABEZADOS DE LA TABLA (ESTILO EXCEL) */}
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#0a0f1d' }}>
                <tr style={{ borderBottom: '2px solid rgba(59, 130, 246, 0.3)', color: '#93c5fd' }}>
                  <th style={{ padding: '0.7rem 0.4rem', textAlign: 'center', width: '35px' }} className="no-print">#</th>
                  <th style={{ padding: '0.7rem 0.3rem', width: '30px', textAlign: 'center' }} className="no-print">Ver</th>
                  <th style={{ padding: '0.7rem 0.6rem', minWidth: '170px' }}>Estudiante</th>
                  <th style={{ padding: '0.7rem 0.4rem', minWidth: '55px', textAlign: 'center' }}>Edad</th>
                  <th style={{ padding: '0.7rem 0.4rem', minWidth: '50px', textAlign: 'center' }}>Sexo</th>
                  <th style={{ padding: '0.7rem 0.6rem', minWidth: '110px' }}>Salón</th>
                  <th style={{ padding: '0.7rem 0.6rem', minWidth: '150px' }}>Representante</th>
                  <th style={{ padding: '0.7rem 0.5rem', minWidth: '105px' }}>Teléfono</th>
                  <th style={{ padding: '0.7rem 0.5rem', minWidth: '95px' }}>Salida</th>
                  <th style={{ padding: '0.7rem 0.4rem', minWidth: '70px', textAlign: 'center' }}>Hoy</th>
                  <th style={{ padding: '0.7rem 0.4rem', minWidth: '80px', textAlign: 'center' }}>Total Asist.</th>

                  {/* COLUMNAS DINÁMICAS DE LAS FECHAS SELECCIONADAS */}
                  {modoVista === 'matriz' && fechasSeleccionadas.map(f => (
                    <th 
                      key={f.fecha} 
                      style={{ 
                        padding: '0.7rem 0.4rem', 
                        minWidth: '75px', 
                        textAlign: 'center',
                        background: 'rgba(30, 41, 59, 0.75)',
                        borderLeft: '1px solid rgba(255, 255, 255, 0.07)'
                      }}
                      title={`Fecha: ${formatearFechaCompleta(f.fecha)}`}
                    >
                      <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{formatearFechaCorta(f.fecha)}</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', fontWeight: 400 }}>Domingo</div>
                    </th>
                  ))}

                  {/* Columna opcional para impresión de 1 solo domingo: Firma / Observación */}
                  {alcanceFechas === 'fecha-especifica' && incluirFirmaEnImpresion && (
                    <th style={{ padding: '0.7rem 0.6rem', minWidth: '130px', textAlign: 'center' }} className="print-only-col">
                      Firma de Retiro / Tutor
                    </th>
                  )}
                </tr>
              </thead>

              {/* CUERPO DE LA TABLA */}
              <tbody>
                {estudiantesFiltrados.map((est, index) => {
                  const estaExpandida = filasExpandidas.has(est.id) || modoVista === 'desglosado';
                  const esGraduado = est.salon_actual === 'Graduado' || est.edadCalculada > 12;

                  return (
                    <React.Fragment key={est.id || index}>
                      <tr 
                        className={`excel-row ${estaExpandida ? 'excel-row-expanded' : ''}`}
                        onClick={() => toggleFila(est.id)}
                        style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                          cursor: 'pointer',
                          backgroundColor: index % 2 === 0 ? 'rgba(15, 23, 42, 0.35)' : 'transparent',
                          transition: 'background-color 0.15s'
                        }}
                      >
                        {/* Índice # */}
                        <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.78rem' }} className="no-print">
                          {index + 1}
                        </td>

                        {/* Flecha Desplegable */}
                        <td style={{ padding: '0.6rem 0.2rem', textAlign: 'center' }} className="no-print">
                          {estaExpandida ? (
                            <ChevronDown size={15} color="var(--accent-primary)" />
                          ) : (
                            <ChevronRight size={15} color="var(--text-secondary)" />
                          )}
                        </td>

                        {/* Estudiante (Nombre y Apellido) */}
                        <td style={{ padding: '0.6rem 0.6rem', fontWeight: 600, color: 'white' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span>{est.nombre} {est.apellido}</span>
                            {est.ticketActual && (
                              <span style={{ 
                                background: 'rgba(59, 130, 246, 0.18)', 
                                color: '#93c5fd', 
                                border: '1px solid rgba(59, 130, 246, 0.4)',
                                padding: '1px 4px', 
                                borderRadius: '4px', 
                                fontSize: '0.7rem',
                                fontWeight: 700
                              }}>
                                #{est.ticketActual}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Edad */}
                        <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center', color: 'white' }}>
                          <strong>{est.edadCalculada}</strong>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: '2px' }}>a</span>
                        </td>

                        {/* Género */}
                        <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center' }}>
                          <span style={{
                            fontSize: '0.72rem',
                            padding: '2px 5px',
                            borderRadius: '4px',
                            background: est.genero === 'Niña' ? 'rgba(236, 72, 153, 0.18)' : 'rgba(59, 130, 246, 0.18)',
                            color: est.genero === 'Niña' ? '#f472b6' : '#60a5fa',
                            border: `1px solid ${est.genero === 'Niña' ? 'rgba(236, 72, 153, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
                          }}>
                            {est.genero === 'Niña' ? 'F' : 'M'}
                          </span>
                        </td>

                        {/* Salón Actual */}
                        <td style={{ padding: '0.6rem 0.6rem' }}>
                          <span style={{
                            fontSize: '0.72rem',
                            padding: '2px 7px',
                            borderRadius: '12px',
                            fontWeight: 500,
                            background: esGraduado ? 'rgba(234, 179, 8, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: esGraduado ? '#fef08a' : '#bfdbfe',
                            border: `1px solid ${esGraduado ? 'rgba(234, 179, 8, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            {esGraduado && <GraduationCap size={11} color="#eab308" />}
                            {est.salon_actual || 'Usos Múltiples'}
                          </span>
                        </td>

                        {/* Representante */}
                        <td style={{ padding: '0.6rem 0.6rem', color: '#e2e8f0' }}>
                          <div>{est.repLimpio || 'No registrado'}</div>
                          {est.parentesco && est.parentesco !== 'Representante' && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>({est.parentesco})</span>
                          )}
                        </td>

                        {/* Teléfono */}
                        <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-secondary)' }}>
                          {est.telefono_representante ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.78rem', color: '#cbd5e1' }}>
                              <Phone size={11} color="var(--accent-primary)" />
                              {est.telefono_representante}
                            </span>
                          ) : (
                            <span style={{ color: '#64748b' }}>—</span>
                          )}
                        </td>

                        {/* Modo de Salida */}
                        <td style={{ padding: '0.6rem 0.5rem' }}>
                          <span style={{
                            fontSize: '0.7rem',
                            padding: '2px 5px',
                            borderRadius: '4px',
                            background: est.modoSalida === 'Se va solo/a' ? 'rgba(234, 179, 8, 0.18)' : 'rgba(100, 116, 139, 0.18)',
                            color: est.modoSalida === 'Se va solo/a' ? '#fde047' : '#94a3b8'
                          }}>
                            {est.modoSalida === 'Se va solo/a' ? 'Se va solo' : 'Con tutor'}
                          </span>
                        </td>

                        {/* Hoy (Activo) */}
                        <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center' }}>
                          {est.asistioHoy ? (
                            <span style={{ 
                              background: 'rgba(34, 197, 94, 0.2)', 
                              color: '#4ade80', 
                              border: '1px solid rgba(34, 197, 94, 0.4)',
                              padding: '2px 5px', 
                              borderRadius: '4px', 
                              fontSize: '0.72rem',
                              fontWeight: 'bold' 
                            }}>
                              ✓ Presente
                            </span>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>—</span>
                          )}
                        </td>

                        {/* Total Asistencias / % */}
                        <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center' }}>
                          <span style={{ fontWeight: 'bold', color: 'white' }}>{est.totalAsistencias}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: '3px' }}>
                            ({est.porcentajeAsistencia}%)
                          </span>
                        </td>

                        {/* CELDAS DINÁMICAS DE LAS FECHAS SELECCIONADAS */}
                        {modoVista === 'matriz' && fechasSeleccionadas.map(f => {
                          const asist = est.asistenciasPorFecha[f.fecha];
                          const asistio = asist && asist.asistio;

                          return (
                            <td 
                              key={f.fecha} 
                              style={{ 
                                padding: '0.5rem 0.3rem', 
                                textAlign: 'center',
                                borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
                                background: asistio ? 'rgba(34, 197, 94, 0.06)' : 'transparent'
                              }}
                              title={`${est.nombre} el ${formatearFechaCompleta(f.fecha)}: ${asistio ? 'Asistió' : 'Ausente'}`}
                            >
                              {asistio ? (
                                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    background: 'rgba(34, 197, 94, 0.2)',
                                    color: '#4ade80',
                                    fontWeight: 'bold',
                                    fontSize: '0.75rem'
                                  }}>
                                    ✓
                                  </span>
                                  {asist.ticket && (
                                    <span style={{ fontSize: '0.62rem', color: '#86efac', marginTop: '1px' }}>
                                      #{asist.ticket}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: '#475569', fontSize: '0.85rem' }}>—</span>
                              )}
                            </td>
                          );
                        })}

                        {/* Espacio para firma manuscrita si es domingo específico */}
                        {alcanceFechas === 'fecha-especifica' && incluirFirmaEnImpresion && (
                          <td style={{ borderLeft: '1px dashed #ccc', height: '26px' }} className="print-only-col">
                            {/* Celda vacía para firma en hoja de papel */}
                          </td>
                        )}
                      </tr>

                      {/* ================= FILA EXPANDIDA: DESGLOSE COMPLETO ================= */}
                      {estaExpandida && (
                        <tr className="excel-expanded-card-row">
                          <td colSpan={11 + (modoVista === 'matriz' ? fechasSeleccionadas.length : 0) + (alcanceFechas === 'fecha-especifica' && incluirFirmaEnImpresion ? 1 : 0)} style={{ padding: '0.75rem 1.25rem', background: 'rgba(15, 23, 42, 0.75)', borderBottom: '2px solid var(--accent-primary)' }}>
                            <div style={{
                              background: 'rgba(2, 6, 23, 0.6)',
                              borderRadius: '8px',
                              padding: '1rem',
                              border: '1px solid var(--glass-border)',
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                              gap: '1rem'
                            }}>
                              
                              {/* Tarjeta 1: Datos Personales */}
                              <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.08)', paddingRight: '1rem' }}>
                                <h4 style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Users size={14} /> Ficha del Estudiante
                                </h4>
                                <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                  <div><strong>Nombre Completo:</strong> {est.nombre} {est.apellido}</div>
                                  <div><strong>Género:</strong> {est.genero || 'No especificado'}</div>
                                  <div><strong>Fecha Nacimiento:</strong> {est.fecha_nacimiento ? formatearFechaCompleta(est.fecha_nacimiento) : 'No registrada'}</div>
                                  <div><strong>Edad Calculada:</strong> {est.edadCalculada} años</div>
                                  <div><strong>Salón Asignado:</strong> {est.salon_actual || 'Usos Múltiples'}</div>
                                  <div><strong>ID Registro:</strong> <code style={{ fontSize: '0.75rem', opacity: 0.7 }}>{est.id}</code></div>
                                </div>
                              </div>

                              {/* Tarjeta 2: Representante */}
                              <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.08)', paddingRight: '1rem' }}>
                                <h4 style={{ fontSize: '0.85rem', color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Phone size={14} /> Contacto y Retiro
                                </h4>
                                <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                  <div><strong>Representante:</strong> {est.repLimpio || 'No especificado'}</div>
                                  <div><strong>Parentesco:</strong> {est.parentesco}</div>
                                  <div>
                                    <strong>Teléfono:</strong> {est.telefono_representante ? (
                                      <a 
                                        href={`https://wa.me/58${est.telefono_representante.replace(/^0/, '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: '#60a5fa', textDecoration: 'none', marginLeft: '4px' }}
                                        onClick={e => e.stopPropagation()}
                                      >
                                        {est.telefono_representante} (WhatsApp)
                                      </a>
                                    ) : 'Sin teléfono registrado'}
                                  </div>
                                  <div>
                                    <strong>Modo de Salida:</strong>{' '}
                                    <span style={{ fontWeight: 600, color: est.modoSalida === 'Se va solo/a' ? '#fde047' : '#94a3b8' }}>
                                      {est.modoSalida}
                                    </span>
                                  </div>
                                  <div><strong>Ticket Actual:</strong> {est.ticketActual ? `#${est.ticketActual}` : 'Sin ticket activo'}</div>
                                  <div><strong>Registrado en Sistema:</strong> {est.created_at ? formatearFechaCompleta(est.created_at) : 'N/A'}</div>
                                </div>
                              </div>

                              {/* Tarjeta 3: Historial */}
                              <div>
                                <h4 style={{ fontSize: '0.85rem', color: '#facc15', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Calendar size={14} /> Historial Cronológico ({est.totalAsistencias} / {historialFechas.length})
                                </h4>
                                {historialFechas.length === 0 ? (
                                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No hay domingos archivados en el historial aún.</p>
                                ) : (
                                  <div style={{ maxHeight: '110px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', paddingRight: '4px' }}>
                                    {historialFechas.map(f => {
                                      const asist = est.asistenciasPorFecha[f.fecha];
                                      const vino = asist && asist.asistio;
                                      return (
                                        <div 
                                          key={f.fecha}
                                          style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            fontSize: '0.78rem',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            background: vino ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.03)'
                                          }}
                                        >
                                          <span>{formatearFechaCompleta(f.fecha)}</span>
                                          <span style={{ fontWeight: 600, color: vino ? '#4ade80' : '#64748b' }}>
                                            {vino ? (asist.ticket ? `Asistió (#${asist.ticket})` : 'Asistió') : 'Ausente'}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>

            </table>
          </div>

          {/* Pie de tabla con resumen de registros */}
          <div style={{ padding: '0.75rem 1.25rem', background: '#0a0f1d', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span>Mostrando <strong>{estudiantesFiltrados.length}</strong> de <strong>{estudiantes.length}</strong> estudiantes ({fechasSeleccionadas.length} domingos en vista)</span>
            <span>Tip: Haz clic sobre cualquier fila para desglosar y ver la ficha individual.</span>
          </div>
        </div>
      )}

      {/* ================= MODAL INTELIGENTE DE OPCIONES DE IMPRESIÓN ================= */}
      {mostrarModalImpresion && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '560px',
            width: '100%',
            border: '1px solid var(--accent-primary)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Printer size={22} color="var(--accent-primary)" />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Opciones de Impresión Profesional</h3>
              </div>
              <button
                onClick={() => setMostrarModalImpresion(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.2rem' }}>
              Selecciona el formato ideal para que la hoja quede <strong>nítida, espaciosa y sin desbordarse</strong> en papel físico o PDF:
            </p>

            {/* Opciones de Formato */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              
              {/* Opción 1: Mes actual (4 semanas) */}
              <label 
                onClick={() => setAlcanceFechas('ultimas-4')}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.8rem 1rem',
                  borderRadius: '8px',
                  background: alcanceFechas === 'ultimas-4' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(15, 23, 42, 0.5)',
                  border: `1.5px solid ${alcanceFechas === 'ultimas-4' ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                  cursor: 'pointer'
                }}
              >
                <input 
                  type="radio" 
                  name="print-scope" 
                  checked={alcanceFechas === 'ultimas-4'} 
                  onChange={() => setAlcanceFechas('ultimas-4')}
                  style={{ marginTop: '3px', width: 'auto' }}
                />
                <div style={{ flex: 1 }}>
                  <strong style={{ color: 'white', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    📊 Planilla Mensual (Últimas 4 semanas)
                    <span style={{ fontSize: '0.7rem', background: '#107c41', color: 'white', padding: '1px 6px', borderRadius: '4px' }}>Recomendado</span>
                  </strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                    Ajuste perfecto en hoja horizontal (Landscape). Columnas amplias y letras grandes legibles.
                  </span>
                </div>
              </label>

              {/* Opción 2: Bimestre (8 semanas) */}
              <label 
                onClick={() => setAlcanceFechas('ultimas-8')}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.8rem 1rem',
                  borderRadius: '8px',
                  background: alcanceFechas === 'ultimas-8' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(15, 23, 42, 0.5)',
                  border: `1.5px solid ${alcanceFechas === 'ultimas-8' ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                  cursor: 'pointer'
                }}
              >
                <input 
                  type="radio" 
                  name="print-scope" 
                  checked={alcanceFechas === 'ultimas-8'} 
                  onChange={() => setAlcanceFechas('ultimas-8')}
                  style={{ marginTop: '3px', width: 'auto' }}
                />
                <div style={{ flex: 1 }}>
                  <strong style={{ color: 'white', fontSize: '0.92rem' }}>
                    📈 Planilla Bimestral (Últimas 8 semanas)
                  </strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                    Ideal para evaluar asistencia en períodos de 2 meses en hoja apaisada.
                  </span>
                </div>
              </label>

              {/* Opción 3: Un Domingo Específico (Control semanal con firma) */}
              <label 
                onClick={() => setAlcanceFechas('fecha-especifica')}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.8rem 1rem',
                  borderRadius: '8px',
                  background: alcanceFechas === 'fecha-especifica' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(15, 23, 42, 0.5)',
                  border: `1.5px solid ${alcanceFechas === 'fecha-especifica' ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                  cursor: 'pointer'
                }}
              >
                <input 
                  type="radio" 
                  name="print-scope" 
                  checked={alcanceFechas === 'fecha-especifica'} 
                  onChange={() => setAlcanceFechas('fecha-especifica')}
                  style={{ marginTop: '3px', width: 'auto' }}
                />
                <div style={{ flex: 1 }}>
                  <strong style={{ color: 'white', fontSize: '0.92rem' }}>
                    📋 Control Semanal de 1 Domingo (Con espacio para firma)
                  </strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                    Genera la lista del domingo seleccionado con ticket, retiro y espacio para firma de entrega.
                  </span>

                  {alcanceFechas === 'fecha-especifica' && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <select
                        value={fechaEspecifica}
                        onChange={e => setFechaEspecifica(e.target.value)}
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem', width: 'auto' }}
                        onClick={e => e.stopPropagation()}
                      >
                        {historialFechas.map(f => (
                          <option key={f.fecha} value={f.fecha}>
                            {formatearFechaCompleta(f.fecha)}
                          </option>
                        ))}
                      </select>
                      <label style={{ fontSize: '0.78rem', color: '#93c5fd', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input 
                          type="checkbox" 
                          checked={incluirFirmaEnImpresion} 
                          onChange={e => setIncluirFirmaEnImpresion(e.target.checked)} 
                          style={{ width: 'auto' }}
                        />
                        Columna Firma
                      </label>
                    </div>
                  )}
                </div>
              </label>

              {/* Opción 4: Directorio General sin fechas */}
              <label 
                onClick={() => setAlcanceFechas('sin-fechas')}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.8rem 1rem',
                  borderRadius: '8px',
                  background: alcanceFechas === 'sin-fechas' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(15, 23, 42, 0.5)',
                  border: `1.5px solid ${alcanceFechas === 'sin-fechas' ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                  cursor: 'pointer'
                }}
              >
                <input 
                  type="radio" 
                  name="print-scope" 
                  checked={alcanceFechas === 'sin-fechas'} 
                  onChange={() => setAlcanceFechas('sin-fechas')}
                  style={{ marginTop: '3px', width: 'auto' }}
                />
                <div style={{ flex: 1 }}>
                  <strong style={{ color: 'white', fontSize: '0.92rem' }}>
                    🗂️ Directorio General (Solo datos del niño y representante)
                  </strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                    Imprime lista limpia con teléfonos, salón, salida y total acumulado de asistencias.
                  </span>
                </div>
              </label>

            </div>

            {/* Botones de acción del Modal */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setMostrarModalImpresion(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--glass-border)',
                  color: 'white',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={ejecutarImpresion}
                className="btn-primary"
                style={{
                  margin: 0,
                  width: 'auto',
                  padding: '0.6rem 1.5rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Printer size={16} />
                Mandar a Imprimir Ahora
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
