import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Search, GraduationCap, Phone, ShieldCheck, Trash2 } from 'lucide-react';
import ModalEditarEstudiante from './ModalEditarEstudiante';
import ModalConfirmacion from './ModalConfirmacion';

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

export default function ModalGraduados({ onClose, onEstudianteEditado }) {
  const [graduados, setGraduados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  
  // Modales
  const [estudianteAEditar, setEstudianteAEditar] = useState(null);
  const [estudianteAEliminar, setEstudianteAEliminar] = useState(null);
  const [isEliminando, setIsEliminando] = useState(false);

  useEffect(() => {
    fetchGraduados();
  }, []);

  const fetchGraduados = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('estudiantes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching graduados:', error);
    } else {
      const filtradosGraduados = (data || []).filter(e => {
        if (e.salon_actual === 'Graduado') return true;
        if (e.fecha_nacimiento) {
          const age = calcularEdad(e.fecha_nacimiento);
          return age > 12;
        }
        return false;
      });
      setGraduados(filtradosGraduados);
    }
    setLoading(false);
  };

  const handleConfirmarEliminar = async () => {
    if (!estudianteAEliminar) return;
    setIsEliminando(true);
    const { error } = await supabase
      .from('estudiantes')
      .delete()
      .eq('id', estudianteAEliminar.id);

    if (error) {
      console.error('Error al eliminar graduado:', error);
      alert('Hubo un error al eliminar el registro.');
    } else {
      setEstudianteAEliminar(null);
      await fetchGraduados();
      if (onEstudianteEditado) onEstudianteEditado();
    }
    setIsEliminando(false);
  };

  const limpiarNombreRepresentante = (repInfo) => {
    if (!repInfo) return '';
    return repInfo
      .replace(/\s*\|\s*Ticket:\s*#?\w+/i, '')
      .replace(/\s*Ticket:\s*#?\w+/i, '')
      .replace(/\s*\|\s*Salida:\s*[^)]+/i, '')
      .replace(/\s*Salida:\s*[^)]+/i, '')
      .trim();
  };

  const termino = busqueda.trim().toLowerCase();
  const listaFiltrada = graduados.filter(e => {
    if (!termino) return true;
    const nombreCompleto = `${e.nombre || ''} ${e.apellido || ''}`.toLowerCase();
    const rep = (e.nombre_representante || '').toLowerCase();
    const tel = (e.telefono_representante || '').toLowerCase();
    return nombreCompleto.includes(termino) || rep.includes(termino) || tel.includes(termino);
  });

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '750px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative',
        border: '2px solid #eab308'
      }}>
        {/* Header del Modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.8rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fef08a' }}>
              <GraduationCap size={28} color="#eab308" /> Registro de Estudiantes Graduados
            </h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Total Graduados: <strong>{graduados.length} estudiantes</strong>
            </span>
          </div>

          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Buscador interno */}
        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input 
            type="text" 
            value={busqueda} 
            onChange={e => setBusqueda(e.target.value)} 
            placeholder="Buscar graduado por nombre, representante o teléfono..." 
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
          {busqueda && (
            <button 
              onClick={() => setBusqueda('')} 
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Lista de Graduados */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            Cargando lista de graduados...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {listaFiltrada.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', gridColumn: '1 / -1', padding: '2rem 0' }}>
                {busqueda ? `No se encontraron graduados para "${busqueda}".` : 'Aún no hay estudiantes graduados registrados.'}
              </p>
            ) : (
              listaFiltrada.map(e => {
                const edadEst = calcularEdad(e.fecha_nacimiento);
                const repLimpio = limpiarNombreRepresentante(e.nombre_representante);

                return (
                  <div 
                    key={e.id} 
                    style={{ 
                      background: 'var(--bg-secondary)', 
                      border: '1px solid rgba(234, 179, 8, 0.3)', 
                      borderLeft: '4px solid #eab308',
                      borderRadius: '12px', 
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'white' }}>
                          {e.nombre} {e.apellido}
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ background: 'rgba(234, 179, 8, 0.2)', border: '1px solid #eab308', color: '#fef08a', fontSize: '0.75rem', fontWeight: 'bold', padding: '0.15rem 0.5rem', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            🎓 Graduado/a
                          </span>

                          <button
                            onClick={() => setEstudianteAEliminar(e)}
                            style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '0.35rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Eliminar registro de graduado"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                        {edadEst > 0 ? `${edadEst} años` : ''} {e.genero ? `(${e.genero})` : ''}
                      </div>

                      {repLimpio && (
                        <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.03)', padding: '0.5rem', borderRadius: '6px', marginTop: '0.4rem' }}>
                          <div style={{ color: 'white', fontWeight: '500' }}>
                            <ShieldCheck size={14} color="#fbbf24" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                            {repLimpio}
                          </div>
                          {e.telefono_representante && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                              <Phone size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                              {e.telefono_representante}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Modal Confirmación de Eliminación */}
        {estudianteAEliminar && (
          <ModalConfirmacion
            titulo="¿Eliminar Estudiante Graduado?"
            mensaje={`¿Estás seguro de que deseas eliminar permanentemente a ${estudianteAEliminar.nombre} ${estudianteAEliminar.apellido} del registro de graduados?`}
            textoBotonConfirmar="Sí, Eliminar"
            onCancelar={() => setEstudianteAEliminar(null)}
            onConfirmar={handleConfirmarEliminar}
            isCargando={isEliminando}
          />
        )}

        {/* Modal Editar dentro de Graduados si se requiere */}
        {estudianteAEditar && (
          <ModalEditarEstudiante
            estudiante={estudianteAEditar}
            onClose={() => setEstudianteAEditar(null)}
            onSaved={() => {
              fetchGraduados();
              if (onEstudianteEditado) onEstudianteEditado();
            }}
          />
        )}
      </div>
    </div>
  );
}
