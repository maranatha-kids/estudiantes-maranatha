import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Folder, ChevronLeft, Calendar, Trash2, Search, Ticket, Phone } from 'lucide-react';
import ModalConfirmacion from './ModalConfirmacion';

export default function HistorialDomingos() {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [carpetaSeleccionada, setCarpetaSeleccionada] = useState(null);
  const [busquedaHistorial, setBusquedaHistorial] = useState('');
  
  // Modales de eliminación
  const [registroAEliminar, setRegistroAEliminar] = useState(null);
  const [isEliminando, setIsEliminando] = useState(false);

  const [estudianteAEliminarHistorial, setEstudianteAEliminarHistorial] = useState(null);
  const [isEliminandoEstudiante, setIsEliminandoEstudiante] = useState(false);

  useEffect(() => {
    fetchHistorial();
  }, []);

  const fetchHistorial = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('historial_domingos')
      .select('*')
      .order('fecha', { ascending: false });

    if (error) {
      console.error('Error fetching historial:', error);
    } else {
      // Agrupar registros por fecha (YYYY-MM-DD) para consolidar carpetas del mismo día
      const agrupadosPorFecha = {};

      (data || []).forEach(item => {
        const fechaClave = item.fecha ? item.fecha.split('T')[0] : 'Sin fecha';
        if (!agrupadosPorFecha[fechaClave]) {
          agrupadosPorFecha[fechaClave] = {
            id: item.id,
            ids: [item.id],
            fecha: fechaClave,
            estudiantes: []
          };
        } else {
          agrupadosPorFecha[fechaClave].ids.push(item.id);
        }

        const listEst = item.estudiantes || [];
        listEst.forEach(est => {
          if (!agrupadosPorFecha[fechaClave].estudiantes.some(e => e.id === est.id || (e.nombre === est.nombre && e.apellido === est.apellido))) {
            agrupadosPorFecha[fechaClave].estudiantes.push(est);
          }
        });
      });

      const listaFormateada = Object.values(agrupadosPorFecha);
      setHistorial(listaFormateada);

      // Si hay una carpeta seleccionada, actualizar sus datos reflejados
      if (carpetaSeleccionada) {
        const actualizada = listaFormateada.find(c => c.fecha === carpetaSeleccionada.fecha);
        if (actualizada) {
          setCarpetaSeleccionada(actualizada);
        }
      }
    }
    setLoading(false);
  };

  const handleAbrirEliminar = (e, registro) => {
    e.stopPropagation();
    setRegistroAEliminar(registro);
  };

  const handleConfirmarEliminar = async () => {
    if (!registroAEliminar) return;
    setIsEliminando(true);
    const idsAEliminar = registroAEliminar.ids || [registroAEliminar.id];
    const { error } = await supabase.from('historial_domingos').delete().in('id', idsAEliminar);
    if (error) {
      console.error('Error deleting:', error);
      alert('Hubo un error al eliminar la carpeta del historial.');
    } else {
      setRegistroAEliminar(null);
      if (carpetaSeleccionada && (carpetaSeleccionada.ids || []).some(id => idsAEliminar.includes(id))) {
        setCarpetaSeleccionada(null);
      }
      fetchHistorial();
    }
    setIsEliminando(false);
  };

  const handleConfirmarEliminarEstudianteHistorial = async () => {
    if (!estudianteAEliminarHistorial || !carpetaSeleccionada) return;
    setIsEliminandoEstudiante(true);

    try {
      const idsActualizar = carpetaSeleccionada.ids || [carpetaSeleccionada.id];
      const nuevosEstudiantes = (carpetaSeleccionada.estudiantes || []).filter(e => 
        e.id !== estudianteAEliminarHistorial.id && 
        !(e.nombre === estudianteAEliminarHistorial.nombre && e.apellido === estudianteAEliminarHistorial.apellido)
      );

      for (const id of idsActualizar) {
        await supabase
          .from('historial_domingos')
          .update({ estudiantes: nuevosEstudiantes })
          .eq('id', id);
      }

      setEstudianteAEliminarHistorial(null);
      await fetchHistorial();
    } catch (err) {
      console.error('Error al remover estudiante del historial:', err);
      alert('Error al remover el estudiante del historial.');
    } finally {
      setIsEliminandoEstudiante(false);
    }
  };

  const formatearFecha = (fechaISO) => {
    const partes = fechaISO.split('-');
    if (partes.length === 3) {
      const anio = parseInt(partes[0], 10);
      const mes = parseInt(partes[1], 10) - 1;
      const dia = parseInt(partes[2], 10);
      const fecha = new Date(anio, mes, dia);
      const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const nombreDia = diasSemana[fecha.getDay()];
      return `${nombreDia} ${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return fechaISO;
  };

  const extraerTicket = (repInfo) => {
    if (!repInfo) return null;
    const match = repInfo.match(/Ticket:\s*#?([0-9A-Za-z]+)/i);
    return match ? match[1] : null;
  };

  const extraerModoSalida = (repInfo) => {
    if (!repInfo) return 'Lo vienen a buscar';
    if (repInfo.toLowerCase().includes('se va solo')) return 'Se va solo/a';
    return 'Lo vienen a buscar';
  };

  const abrirCarpeta = (registro) => {
    setCarpetaSeleccionada(registro);
    setBusquedaHistorial('');
  };

  if (loading) {
    return <div className="glass-panel" style={{ textAlign: 'center' }}>Cargando historial...</div>;
  }

  if (carpetaSeleccionada) {
    const estudiantes = carpetaSeleccionada.estudiantes || [];
    const lista = estudiantes;
    const ninos = lista.filter(e => e.genero === 'Niño').length;
    const ninas = lista.filter(e => e.genero === 'Niña').length;

    // Filtrar la lista según la búsqueda del usuario
    const termino = busquedaHistorial.trim().toLowerCase();
    const listaFiltrada = lista.filter(e => {
      if (!termino) return true;
      const ticketNum = (extraerTicket(e.nombre_representante) || '').toLowerCase();
      const nombreCompleto = `${e.nombre || ''} ${e.apellido || ''}`.toLowerCase();
      const repInfo = (e.nombre_representante || '').toLowerCase();
      const tel = (e.telefono_representante || '').toLowerCase();

      return nombreCompleto.includes(termino) || 
             ticketNum.includes(termino.replace('#', '')) || 
             repInfo.includes(termino) || 
             tel.includes(termino);
    });

    return (
      <div className="glass-panel" style={{ animation: 'fadeIn 0.3s ease-out' }}>
        <button 
          onClick={() => {
            setCarpetaSeleccionada(null);
            setBusquedaHistorial('');
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', marginBottom: '1.5rem', fontSize: '1rem' }}
        >
          <ChevronLeft size={20} /> Volver a las carpetas
        </button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <Folder color="var(--accent-primary)" size={28} />
            Asistencia del {formatearFecha(carpetaSeleccionada.fecha)} — Usos Múltiples
          </h2>
          <span className="salon-badge" style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>
            Total: {lista.length} | {ninos} Niños | {ninas} Niñas
          </span>
        </div>

        {/* Buscador interno de la carpeta */}
        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input 
            type="text" 
            value={busquedaHistorial} 
            onChange={e => setBusquedaHistorial(e.target.value)} 
            placeholder="Buscar por Ticket # (Ej: 001), Nombre o Representante..." 
            style={{ 
              paddingLeft: '2.5rem', 
              width: '100%', 
              background: 'var(--bg-secondary)', 
              border: '1px solid var(--glass-border)', 
              borderRadius: '8px', 
              color: 'white', 
              fontSize: '0.95rem' 
            }}
          />
          {busquedaHistorial && (
            <button 
              onClick={() => setBusquedaHistorial('')} 
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Limpiar
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {listaFiltrada.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', gridColumn: '1 / -1', textAlign: 'center', padding: '2rem 0' }}>
              {busquedaHistorial ? `No se encontraron resultados para "${busquedaHistorial}".` : 'No hubo asistencia registrada en este domingo.'}
            </p>
          ) : (
            listaFiltrada.map(e => {
              const ticketNum = extraerTicket(e.nombre_representante);
              const modoSalidaCard = extraerModoSalida(e.nombre_representante);
              return (
                <div key={e.id || e.nombre + e.apellido} className="estudiante-item" style={{ borderLeft: `4px solid ${e.genero === 'Niña' ? '#ec4899' : e.genero === 'Niño' ? 'var(--accent-primary)' : 'var(--text-secondary)'}`, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                        {ticketNum && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid var(--accent-primary)', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            <Ticket size={14} color="var(--accent-primary)" /> Ticket #{ticketNum}
                          </div>
                        )}
                        {modoSalidaCard && (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: modoSalidaCard === 'Se va solo/a' ? 'rgba(234, 179, 8, 0.18)' : 'rgba(59, 130, 246, 0.15)',
                            border: `1px solid ${modoSalidaCard === 'Se va solo/a' ? '#eab308' : 'var(--accent-primary)'}`,
                            color: 'white',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px'
                          }}>
                            {modoSalidaCard === 'Se va solo/a' ? '🚶 Se va solo/a' : '🚗 Lo vienen a buscar'}
                          </div>
                        )}
                      </div>

                      {e.nombre_representante && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                          Representante: {e.nombre_representante}
                        </div>
                      )}

                      {e.telefono_representante && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Phone size={14} color="var(--accent-primary)" />
                          <span><strong>Teléfono:</strong> {e.telefono_representante}</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setEstudianteAEliminarHistorial(e)}
                      style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}
                      title="Eliminar registro de esta carpeta"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal de eliminación de estudiante individual del historial */}
        {estudianteAEliminarHistorial && (
          <ModalConfirmacion 
            titulo="¿Eliminar Registro del Historial?"
            mensaje={`¿Deseas remover a ${estudianteAEliminarHistorial.nombre} ${estudianteAEliminarHistorial.apellido} de la carpeta de asistencia del ${formatearFecha(carpetaSeleccionada.fecha)}?`}
            textoBotonConfirmar="Sí, Eliminar"
            onCancelar={() => setEstudianteAEliminarHistorial(null)}
            onConfirmar={handleConfirmarEliminarEstudianteHistorial}
            isCargando={isEliminandoEstudiante}
          />
        )}
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Calendar color="var(--accent-primary)" />
        Historial de Asistencias
      </h2>
      
      {historial.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
          No hay registros en el historial.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
          {historial.map((registro) => (
            <div 
              key={registro.id} 
              onClick={() => abrirCarpeta(registro)}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--glass-border)',
                borderRadius: '12px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'center'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = 'var(--glass-border)';
              }}
            >
              <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                <Folder color="var(--accent-primary)" size={48} style={{ marginBottom: '0.5rem' }} />
                <button
                  onClick={(e) => handleAbrirEliminar(e, registro)}
                  style={{ 
                    position: 'absolute', top: '-10px', right: '-10px', 
                    background: 'rgba(239, 68, 68, 0.2)', border: 'none', 
                    color: '#ef4444', padding: '0.4rem', borderRadius: '50%', 
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                  title="Eliminar historial"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <strong style={{ fontSize: '1rem', color: 'white' }}>
                {formatearFecha(registro.fecha)}
              </strong>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {(registro.estudiantes || []).length} estudiantes
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Modal Personalizado de Confirmación de Eliminación de carpeta */}
      {registroAEliminar && (
        <ModalConfirmacion 
          titulo="¿Eliminar Registro de Asistencia?"
          mensaje={`¿Estás seguro de que deseas eliminar permanentemente la carpeta del ${formatearFecha(registroAEliminar.fecha)} con ${(registroAEliminar.estudiantes || []).length} estudiantes?`}
          textoBotonConfirmar="Sí, Eliminar"
          onCancelar={() => setRegistroAEliminar(null)}
          onConfirmar={handleConfirmarEliminar}
          isCargando={isEliminando}
        />
      )}
    </div>
  );
}
