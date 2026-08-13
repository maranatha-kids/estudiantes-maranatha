import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Users, ShieldCheck, Trash2, Folder, ChevronLeft, Search, Ticket, Phone, Pencil } from 'lucide-react';
import ModalEditarEstudiante from './ModalEditarEstudiante';
import ModalConfirmacion from './ModalConfirmacion';

export default function ListaEstudiantes({ refreshTrigger }) {
  const [estudiantes, setEstudiantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salonSeleccionado, setSalonSeleccionado] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [estudianteAEditar, setEstudianteAEditar] = useState(null);
  const [estudianteARemover, setEstudianteARemover] = useState(null);
  const [isRemoviendo, setIsRemoviendo] = useState(false);

  useEffect(() => {
    fetchEstudiantes();
  }, [refreshTrigger]);

  const fetchEstudiantes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('vista_estudiantes')
      .select('*')
      .eq('activo_este_domingo', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching estudiantes:', error);
    } else {
      setEstudiantes(data || []);
    }
    setLoading(false);
  };

  const handleConfirmarRemover = async () => {
    if (!estudianteARemover) return;
    setIsRemoviendo(true);
    const { error } = await supabase
      .from('estudiantes')
      .update({ activo_este_domingo: false })
      .eq('id', estudianteARemover.id);
    
    if (error) {
      console.error('Error removing student:', error);
      alert('Hubo un error al remover al estudiante.');
    } else {
      setEstudianteARemover(null);
      fetchEstudiantes();
    }
    setIsRemoviendo(false);
  };

  // Filtrar estudiantes por término de búsqueda (Ticket #, Nombre, Cédula, Representante)
  const estudiantesFiltrados = estudiantes.filter(e => {
    if (!busqueda.trim()) return true;
    const term = busqueda.toLowerCase().trim();
    const nombreCompleto = `${e.nombre} ${e.apellido}`.toLowerCase();
    const rep = (e.nombre_representante || '').toLowerCase();
    const tel = (e.telefono_representante || '').toLowerCase();
    return nombreCompleto.includes(term) || rep.includes(term) || tel.includes(term);
  });

  const agrupados = {
    'Usos Múltiples': estudiantesFiltrados.filter(e => e.edad >= 8 && e.edad <= 12)
  };

  if (loading) {
    return <div className="glass-panel" style={{ textAlign: 'center' }}>Cargando datos...</div>;
  }

  // Extraer número de ticket de la cadena si existe
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

  // Limpiar cadena del representante para quitar la duplicación de Ticket y Salida
  const limpiarNombreRepresentante = (repInfo) => {
    if (!repInfo) return '';
    return repInfo
      .replace(/\s*\|\s*Ticket:\s*#?\w+/i, '')
      .replace(/\s*Ticket:\s*#?\w+/i, '')
      .replace(/\s*\|\s*Salida:\s*[^)]+/i, '')
      .replace(/\s*Salida:\s*[^)]+/i, '')
      .trim();
  };

  // VISTA NIVEL 2: Detalle de un salón
  if (salonSeleccionado) {
    const lista = agrupados[salonSeleccionado] || [];
    const ninos = lista.filter(e => e.genero === 'Niño').length;
    const ninas = lista.filter(e => e.genero === 'Niña').length;
    
    const icono = <Users size={28} color="var(--accent-primary)"/>;

    return (
      <div className="glass-panel" style={{ animation: 'fadeIn 0.3s ease-out' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <button 
            onClick={() => setSalonSeleccionado(null)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '1rem' }}
          >
            <ChevronLeft size={20} /> Volver a los salones
          </button>

          {/* Buscador interno por ticket o nombre */}
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.4rem 0.8rem', minWidth: '260px' }}>
            <Search size={18} color="var(--text-secondary)" style={{ marginRight: '8px' }} />
            <input 
              type="text" 
              placeholder="Buscar por Ticket # (Ej: #001), Nombre o Representante..." 
              value={busqueda} 
              onChange={e => setBusqueda(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            {icono}
            Salón {salonSeleccionado}
          </h2>
          <span className="salon-badge" style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>
            Total: {lista.length} | {ninos} Niños | {ninas} Niñas
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {lista.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', gridColumn: '1 / -1' }}>
              {busqueda ? 'No se encontraron resultados para la búsqueda.' : 'No hay estudiantes registrados hoy en este salón.'}
            </p>
          ) : (
            lista.map(e => {
              const ticketNum = extraerTicket(e.nombre_representante);
              const modoSalidaCard = extraerModoSalida(e.nombre_representante);
              const nombreRepLimpio = limpiarNombreRepresentante(e.nombre_representante);
              return (
                <div key={e.id} className="estudiante-item" style={{ borderLeft: `4px solid ${e.genero === 'Niña' ? '#ec4899' : e.genero === 'Niño' ? 'var(--accent-primary)' : 'var(--text-secondary)'}`, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, paddingRight: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                        {ticketNum && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid var(--accent-primary)', color: 'white', fontSize: '0.85rem', fontWeight: 'bold', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
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
                            {modoSalidaCard === 'Se va solo/a' ? 'Se va solo/a' : 'Lo vienen a buscar'}
                          </div>
                        )}
                      </div>
                      
                      <div className="estudiante-nombre" style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{e.nombre} {e.apellido}</div>
                      <div className="estudiante-edad" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{e.edad} años ({e.genero || 'No especificado'})</div>
                      
                      {nombreRepLimpio && (
                        <div className="estudiante-rep" style={{ marginTop: '0.6rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--glass-border)', padding: '0.5rem', borderRadius: '6px' }}>
                          <div style={{ fontSize: '0.85rem', color: 'white', fontWeight: '500' }}>
                            <ShieldCheck size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px', color: '#fbbf24' }}/>
                            {nombreRepLimpio}
                          </div>
                          {e.telefono_representante && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                              <Phone size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}/>
                              {e.telefono_representante}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <button 
                        onClick={() => setEstudianteAEditar(e)}
                        style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid var(--glass-border)', color: 'var(--accent-primary)', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px' }}
                        title="Editar datos del estudiante"
                      >
                        <Pencil size={16} />
                      </button>
                      <button 
                        onClick={() => setEstudianteARemover(e)}
                        style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px' }}
                        title="Remover de la lista de hoy"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal de edición */}
        {estudianteAEditar && (
          <ModalEditarEstudiante 
            estudiante={estudianteAEditar} 
            onClose={() => setEstudianteAEditar(null)} 
            onSaved={fetchEstudiantes} 
          />
        )}

        {/* Modal de confirmación para remover estudiante de la lista de hoy */}
        {estudianteARemover && (
          <ModalConfirmacion 
            titulo="¿Remover Estudiante?"
            mensaje={`¿Estás seguro de que deseas remover a ${estudianteARemover.nombre} ${estudianteARemover.apellido} de la asistencia de hoy?`}
            textoBotonConfirmar="Sí, Remover"
            onCancelar={() => setEstudianteARemover(null)}
            onConfirmar={handleConfirmarRemover}
            isCargando={isRemoviendo}
          />
        )}
      </div>
    );
  }

  // VISTA NIVEL 1: Carpetas
  return (
    <div>
      {/* Buscador global */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '0.6rem 1rem' }}>
        <Search size={20} color="var(--text-secondary)" style={{ marginRight: '10px' }} />
        <input 
          type="text" 
          placeholder="Buscar por Ticket # (Ej: #001), Nombre o Representante..." 
          value={busqueda} 
          onChange={e => setBusqueda(e.target.value)}
          style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', fontSize: '1rem', outline: 'none' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', animation: 'fadeIn 0.3s ease-out' }}>
        {/* Carpeta Usos Múltiples */}
        <div 
          className="glass-panel salon-card" 
          onClick={() => setSalonSeleccionado('Usos Múltiples')}
          style={{ cursor: 'pointer', alignItems: 'center', textAlign: 'center', transition: 'all 0.2s', padding: '2rem' }}
          onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
          onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--glass-border)'; }}
        >
          <Folder color="var(--accent-primary)" fill="var(--glass-border)" size={64} style={{ marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Usos Múltiples</h3>
          <span style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>8 a 12 años</span>
          <span className="salon-badge" style={{ fontSize: '1.1rem', padding: '0.5rem 1rem', background: agrupados['Usos Múltiples'].length >= 300 ? 'rgba(239, 68, 68, 0.25)' : undefined, border: agrupados['Usos Múltiples'].length >= 300 ? '1px solid #ef4444' : undefined, color: agrupados['Usos Múltiples'].length >= 300 ? '#fca5a5' : undefined }}>
            Total: {agrupados['Usos Múltiples'].length} / 300 {agrupados['Usos Múltiples'].length >= 300 ? '(Salón Lleno 🔴)' : ''} | {agrupados['Usos Múltiples'].filter(e=>e.genero==='Niño').length} Niños | {agrupados['Usos Múltiples'].filter(e=>e.genero==='Niña').length} Niñas
          </span>
        </div>
      </div>

      {/* Modal de edición desde vista general si aplica */}
      {estudianteAEditar && (
        <ModalEditarEstudiante 
          estudiante={estudianteAEditar} 
          onClose={() => setEstudianteAEditar(null)} 
          onSaved={fetchEstudiantes} 
        />
      )}

      {/* Modal de confirmación para remover estudiante de la lista de hoy */}
      {estudianteARemover && (
        <ModalConfirmacion 
          titulo="¿Remover Estudiante?"
          mensaje={`¿Estás seguro de que deseas remover a ${estudianteARemover.nombre} ${estudianteARemover.apellido} de la asistencia de hoy?`}
          textoBotonConfirmar="Sí, Remover"
          onCancelar={() => setEstudianteARemover(null)}
          onConfirmar={handleConfirmarRemover}
          isCargando={isRemoviendo}
        />
      )}
    </div>
  );
}
