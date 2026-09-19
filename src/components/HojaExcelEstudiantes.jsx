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
  Calendar
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
          // Guardar referencia por ID y por nombre normalizado
          if (e.id) mapaFechas[fechaStr].estudiantesMap.set(`id:${e.id}`, e);
          const claveNombre = `${(e.nombre || '').trim().toLowerCase()}_${(e.apellido || '').trim().toLowerCase()}`;
          mapaFechas[fechaStr].estudiantesMap.set(`name:${claveNombre}`, e);
        });
      });

      // Ordenar fechas cronológicamente descendente (las más recientes primero)
      const fechasArray = Object.values(mapaFechas).sort((a, b) => b.fecha.localeCompare(a.fecha));

      setEstudiantes(dataEstudiantes || []);
      setHistorialFechas(fechasArray);
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
    
    // Primero buscar por ID exacto
    if (estudiante.id && fechaObj.estudiantesMap.has(`id:${estudiante.id}`)) {
      return fechaObj.estudiantesMap.get(`id:${estudiante.id}`);
    }
    
    // Si no, buscar por nombre y apellido normalizados
    const claveNombre = `${(estudiante.nombre || '').trim().toLowerCase()}_${(estudiante.apellido || '').trim().toLowerCase()}`;
    if (fechaObj.estudiantesMap.has(`name:${claveNombre}`)) {
      return fechaObj.estudiantesMap.get(`name:${claveNombre}`);
    }

    return null;
  };

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

      // Incluir también si está activo el domingo actual
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

      return true;
    });
  }, [estudiantesProcesados, busqueda, filtroSalon, filtroGenero, filtroEstado]);

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

  // Impresión nativa
  const handleImprimir = () => {
    window.print();
  };

  // Exportar a Excel (CSV con UTF-8 BOM)
  const handleExportarExcel = () => {
    try {
      // Encabezados de columnas
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

      // Filas de datos
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

      // Crear contenido CSV con BOM para soporte de caracteres en Excel (tildes, eñes)
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
        <div style={{ borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '15px' }}>
          <h1 style={{ margin: 0, fontSize: '18pt', color: '#000', fontWeight: 'bold' }}>
            Maranatha Kids — Planilla General de Estudiantes
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '9pt', color: '#333' }}>
            Reporte de Base de Datos y Matriz de Asistencias | Fecha: {fechaImpresion}
          </p>
          <div style={{ marginTop: '6px', fontSize: '8.5pt', color: '#222', display: 'flex', gap: '15px' }}>
            <span><strong>Total Estudiantes:</strong> {estudiantesFiltrados.length}</span>
            <span><strong>Niños:</strong> {totalNinos}</span>
            <span><strong>Niñas:</strong> {totalNinas}</span>
            <span><strong>Activos Hoy:</strong> {totalActivosHoy}</span>
            <span><strong>Domingos en Historial:</strong> {historialFechas.length}</span>
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
                Visualización tabular, desglose ficha a ficha y control de asistencias por fecha
              </span>
            </div>
          </div>

          {/* Acciones Principales: Imprimir, Exportar, Recargar */}
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleImprimir}
              className="btn-secondary"
              style={{
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid var(--accent-primary)',
                color: 'white',
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontWeight: 600,
                fontSize: '0.9rem'
              }}
              title="Imprimir planilla o guardar en PDF"
            >
              <Printer size={16} color="var(--accent-primary)" />
              Imprimir Planilla
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
              title="Descargar archivo .CSV compatible con Microsoft Excel"
            >
              <Download size={16} />
              Descargar Excel (.csv)
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1rem'
        }}>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Registrados</span>
            <strong style={{ fontSize: '1.4rem', color: 'white' }}>{estudiantes.length}</strong>
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Listados Filtrados</span>
            <strong style={{ fontSize: '1.4rem', color: 'var(--accent-primary)' }}>{estudiantesFiltrados.length}</strong>
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Activos Hoy</span>
            <strong style={{ fontSize: '1.4rem', color: '#4ade80' }}>{totalActivosHoy}</strong>
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Domingos en Historial</span>
            <strong style={{ fontSize: '1.4rem', color: '#facc15' }}>{historialFechas.length}</strong>
          </div>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Género</span>
            <span style={{ fontSize: '0.95rem', color: 'white', fontWeight: 600, display: 'block', marginTop: '4px' }}>
              👦 {totalNinos} | 👧 {totalNinas}
            </span>
          </div>
        </div>

        {/* Barra de Filtros, Búsqueda y Selector de Modo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            
            {/* Buscador Universal */}
            <div style={{ position: 'relative', flex: '1 1 280px' }}>
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

            {/* Filtro Salón */}
            <div style={{ minWidth: '150px' }}>
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
            <div style={{ minWidth: '120px' }}>
              <select
                value={filtroGenero}
                onChange={e => setFiltroGenero(e.target.value)}
                style={{ padding: '0.65rem 0.8rem', fontSize: '0.85rem' }}
              >
                <option value="todos">Todos los géneros</option>
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
                <option value="regulares">Regulares</option>
                <option value="graduados">Graduados</option>
              </select>
            </div>

          </div>

          {/* Controles de Vista y Desglose Masivo */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.5rem' }}>
            
            {/* Alternador de Vista: Matriz vs Desglose */}
            <div style={{ display: 'inline-flex', background: 'rgba(15, 23, 42, 0.8)', padding: '3px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
              <button
                onClick={() => setModoVista('matriz')}
                style={{
                  background: modoVista === 'matriz' ? 'var(--accent-gradient)' : 'transparent',
                  color: modoVista === 'matriz' ? 'white' : 'var(--text-secondary)',
                  border: 'none',
                  padding: '0.4rem 0.9rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <FileSpreadsheet size={15} /> Matriz de Asistencias (Hoja)
              </button>
              <button
                onClick={() => setModoVista('desglosado')}
                style={{
                  background: modoVista === 'desglosado' ? 'var(--accent-gradient)' : 'transparent',
                  color: modoVista === 'desglosado' ? 'white' : 'var(--text-secondary)',
                  border: 'none',
                  padding: '0.4rem 0.9rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Users size={15} /> Fichas Desglosadas Detalladas
              </button>
            </div>

            {/* Acciones de Desglose rápido */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={expandirTodos}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--glass-border)',
                  color: 'white',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
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
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
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
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', width: '40px' }} className="no-print">#</th>
                  <th style={{ padding: '0.75rem 0.5rem', width: '35px', textAlign: 'center' }} className="no-print">Ver</th>
                  <th style={{ padding: '0.75rem 0.75rem', minWidth: '170px' }}>Estudiante</th>
                  <th style={{ padding: '0.75rem 0.5rem', minWidth: '65px', textAlign: 'center' }}>Edad</th>
                  <th style={{ padding: '0.75rem 0.5rem', minWidth: '55px', textAlign: 'center' }}>Sexo</th>
                  <th style={{ padding: '0.75rem 0.75rem', minWidth: '110px' }}>Salón</th>
                  <th style={{ padding: '0.75rem 0.75rem', minWidth: '150px' }}>Representante</th>
                  <th style={{ padding: '0.75rem 0.5rem', minWidth: '110px' }}>Teléfono</th>
                  <th style={{ padding: '0.75rem 0.5rem', minWidth: '95px' }}>Salida</th>
                  <th style={{ padding: '0.75rem 0.5rem', minWidth: '75px', textAlign: 'center' }}>Hoy</th>
                  <th style={{ padding: '0.75rem 0.5rem', minWidth: '85px', textAlign: 'center' }}>Total Asist.</th>

                  {/* COLUMNAS DINÁMICAS DE CADA FECHA EN EL HISTORIAL */}
                  {modoVista === 'matriz' && historialFechas.map(f => (
                    <th 
                      key={f.fecha} 
                      style={{ 
                        padding: '0.75rem 0.5rem', 
                        minWidth: '75px', 
                        textAlign: 'center',
                        background: 'rgba(30, 41, 59, 0.7)',
                        borderLeft: '1px solid rgba(255, 255, 255, 0.07)'
                      }}
                      title={`Fecha: ${formatearFechaCompleta(f.fecha)}`}
                    >
                      <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{formatearFechaCorta(f.fecha)}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 400 }}>Domingo</div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* CUERPO DE LA TABLA CON CADA ESTUDIANTE */}
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
                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }} className="no-print">
                          {index + 1}
                        </td>

                        {/* Flecha Desplegable */}
                        <td style={{ padding: '0.65rem 0.3rem', textAlign: 'center' }} className="no-print">
                          {estaExpandida ? (
                            <ChevronDown size={16} color="var(--accent-primary)" />
                          ) : (
                            <ChevronRight size={16} color="var(--text-secondary)" />
                          )}
                        </td>

                        {/* Estudiante (Nombre y Apellido) */}
                        <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600, color: 'white' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{est.nombre} {est.apellido}</span>
                            {est.ticketActual && (
                              <span style={{ 
                                background: 'rgba(59, 130, 246, 0.18)', 
                                color: '#93c5fd', 
                                border: '1px solid rgba(59, 130, 246, 0.4)',
                                padding: '1px 5px', 
                                borderRadius: '4px', 
                                fontSize: '0.72rem',
                                fontWeight: 700
                              }}>
                                #{est.ticketActual}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Edad */}
                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', color: 'white' }}>
                          <strong>{est.edadCalculada}</strong>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginLeft: '2px' }}>años</span>
                        </td>

                        {/* Género */}
                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>
                          <span style={{
                            fontSize: '0.75rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: est.genero === 'Niña' ? 'rgba(236, 72, 153, 0.18)' : 'rgba(59, 130, 246, 0.18)',
                            color: est.genero === 'Niña' ? '#f472b6' : '#60a5fa',
                            border: `1px solid ${est.genero === 'Niña' ? 'rgba(236, 72, 153, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
                          }}>
                            {est.genero === 'Niña' ? 'F' : 'M'}
                          </span>
                        </td>

                        {/* Salón Actual */}
                        <td style={{ padding: '0.65rem 0.75rem' }}>
                          <span style={{
                            fontSize: '0.75rem',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontWeight: 500,
                            background: esGraduado ? 'rgba(234, 179, 8, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: esGraduado ? '#fef08a' : '#bfdbfe',
                            border: `1px solid ${esGraduado ? 'rgba(234, 179, 8, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            {esGraduado && <GraduationCap size={12} color="#eab308" />}
                            {est.salon_actual || 'Usos Múltiples'}
                          </span>
                        </td>

                        {/* Representante */}
                        <td style={{ padding: '0.65rem 0.75rem', color: '#e2e8f0' }}>
                          <div>{est.repLimpio || 'No registrado'}</div>
                          {est.parentesco && est.parentesco !== 'Representante' && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>({est.parentesco})</span>
                          )}
                        </td>

                        {/* Teléfono */}
                        <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)' }}>
                          {est.telefono_representante ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.8rem', color: '#cbd5e1' }}>
                              <Phone size={12} color="var(--accent-primary)" />
                              {est.telefono_representante}
                            </span>
                          ) : (
                            <span style={{ color: '#64748b' }}>—</span>
                          )}
                        </td>

                        {/* Modo de Salida */}
                        <td style={{ padding: '0.65rem 0.5rem' }}>
                          <span style={{
                            fontSize: '0.72rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: est.modoSalida === 'Se va solo/a' ? 'rgba(234, 179, 8, 0.18)' : 'rgba(100, 116, 139, 0.18)',
                            color: est.modoSalida === 'Se va solo/a' ? '#fde047' : '#94a3b8'
                          }}>
                            {est.modoSalida === 'Se va solo/a' ? 'Se va solo' : 'Con tutor'}
                          </span>
                        </td>

                        {/* Hoy (Activo) */}
                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>
                          {est.asistioHoy ? (
                            <span style={{ 
                              background: 'rgba(34, 197, 94, 0.2)', 
                              color: '#4ade80', 
                              border: '1px solid rgba(34, 197, 94, 0.4)',
                              padding: '2px 6px', 
                              borderRadius: '4px', 
                              fontSize: '0.75rem',
                              fontWeight: 'bold' 
                            }}>
                              ✓ Presente
                            </span>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>—</span>
                          )}
                        </td>

                        {/* Total Asistencias / % */}
                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>
                          <span style={{ fontWeight: 'bold', color: 'white' }}>{est.totalAsistencias}</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginLeft: '3px' }}>
                            ({est.porcentajeAsistencia}%)
                          </span>
                        </td>

                        {/* CELDAS DINÁMICAS DE ASISTENCIA POR FECHA */}
                        {modoVista === 'matriz' && historialFechas.map(f => {
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
                                    width: '22px',
                                    height: '22px',
                                    borderRadius: '50%',
                                    background: 'rgba(34, 197, 94, 0.2)',
                                    color: '#4ade80',
                                    fontWeight: 'bold',
                                    fontSize: '0.8rem'
                                  }}>
                                    ✓
                                  </span>
                                  {asist.ticket && (
                                    <span style={{ fontSize: '0.65rem', color: '#86efac', marginTop: '1px' }}>
                                      #{asist.ticket}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: '#475569', fontSize: '0.9rem' }}>—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>

                      {/* ================= FILA EXPANDIDA: DESGLOSE COMPLETO DE CADA ESTUDIANTE ================= */}
                      {estaExpandida && (
                        <tr className="excel-expanded-card-row">
                          <td colSpan={11 + (modoVista === 'matriz' ? historialFechas.length : 0)} style={{ padding: '0.75rem 1.25rem', background: 'rgba(15, 23, 42, 0.75)', borderBottom: '2px solid var(--accent-primary)' }}>
                            <div style={{
                              background: 'rgba(2, 6, 23, 0.6)',
                              borderRadius: '8px',
                              padding: '1rem',
                              border: '1px solid var(--glass-border)',
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                              gap: '1rem'
                            }}>
                              
                              {/* Tarjeta 1: Datos Personales del Estudiante */}
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

                              {/* Tarjeta 2: Datos del Representante y Seguridad */}
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

                              {/* Tarjeta 3: Resumen y Desglose de Asistencias */}
                              <div>
                                <h4 style={{ fontSize: '0.85rem', color: '#facc15', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Calendar size={14} /> Historial de Asistencias ({est.totalAsistencias} / {historialFechas.length})
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
            <span>Mostrando <strong>{estudiantesFiltrados.length}</strong> de <strong>{estudiantes.length}</strong> estudiantes</span>
            <span>Tip: Haz clic sobre cualquier fila para desglosar y ver la ficha individual.</span>
          </div>
        </div>
      )}

    </div>
  );
}
