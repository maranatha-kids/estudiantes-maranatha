import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Ticket, CheckCircle2, UserCheck, Plus, ChevronDown, ChevronUp, Phone, ShieldCheck, Sparkles, User } from 'lucide-react';
import CampoFechaNacimiento from './CampoFechaNacimiento';

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

export default function FormularioIngreso({ onEstudianteAgregado, onGraduacion }) {
  // Estado para el buscador rápido de asistencia
  const [busqueda, setBusqueda] = useState('');
  const [todosLosEstudiantes, setTodosLosEstudiantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cargandoId, setCargandoId] = useState(null);
  const [mensajeNotificacion, setMensajeNotificacion] = useState(null);

  // Estado para el formulario manual desplegable (casos excepcionales)
  const [mostrarFormularioManual, setMostrarFormularioManual] = useState(false);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [genero, setGenero] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [nombreRep, setNombreRep] = useState('');
  const [apellidoRep, setApellidoRep] = useState('');
  const [telefonoRep, setTelefonoRep] = useState('');
  const [modoSalida, setModoSalida] = useState('Lo vienen a buscar');
  const [edad, setEdad] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchEstudiantes();
  }, []);

  const fetchEstudiantes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('estudiantes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al obtener estudiantes:', error);
    } else {
      setTodosLosEstudiantes(data || []);
    }
    setLoading(false);
  };

  // Evaluar edad y salón para el formulario manual
  useEffect(() => {
    if (fechaNacimiento) {
      setEdad(calcularEdad(fechaNacimiento));
    } else {
      setEdad(null);
    }
  }, [fechaNacimiento]);

  // Auxiliares de extracción
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

  const limpiarNombreRepresentante = (repInfo) => {
    if (!repInfo) return '';
    return repInfo
      .replace(/\s*\|\s*Ticket:\s*#?\w+/i, '')
      .replace(/\s*Ticket:\s*#?\w+/i, '')
      .replace(/\s*\|\s*Salida:\s*[^)]+/i, '')
      .replace(/\s*Salida:\s*[^)]+/i, '')
      .trim();
  };

  // Accion rapida: Confirmar llegada con 1 clic
  const handleConfirmarLlegada = async (estudiante) => {
    setCargandoId(estudiante.id);
    try {
      const { error } = await supabase
        .from('estudiantes')
        .update({ activo_este_domingo: true })
        .eq('id', estudiante.id);

      if (error) throw error;

      setMensajeNotificacion(`¡Llegada de ${estudiante.nombre} ${estudiante.apellido} confirmada correctamente!`);
      setTimeout(() => setMensajeNotificacion(null), 4000);

      await fetchEstudiantes();
      if (onEstudianteAgregado) onEstudianteAgregado();
    } catch (err) {
      console.error('Error al confirmar llegada:', err);
      alert('Ocurrió un error al confirmar la asistencia.');
    } finally {
      setCargandoId(null);
    }
  };

  // Guardar formulario manual para casos excepcionales
  const handleGuardarManual = async (e) => {
    e.preventDefault();
    if (!nombre.trim() || !apellido.trim() || !genero || !fechaNacimiento) return;

    if (edad < 8 || edad > 12) {
      alert('La edad debe estar entre 8 y 12 años.');
      return;
    }

    setIsSubmitting(true);
    try {
      let repInfo = nombreRep.trim() ? `${nombreRep.trim()} (Salida: ${modoSalida})` : `Representante (Salida: ${modoSalida})`;

      const { error } = await supabase
        .from('estudiantes')
        .insert([{
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          genero,
          fecha_nacimiento: fechaNacimiento,
          salon_actual: 'Usos Múltiples',
          nombre_representante: repInfo,
          apellido_representante: apellidoRep.trim() || null,
          telefono_representante: telefonoRep.trim() || null,
          activo_este_domingo: true
        }]);

      if (error) throw error;

      setMensajeNotificacion(`¡Estudiante ${nombre} ${apellido} registrado y confirmado hoy!`);
      setTimeout(() => setMensajeNotificacion(null), 4000);

      // Limpiar campos
      setNombre('');
      setApellido('');
      setGenero('');
      setFechaNacimiento('');
      setNombreRep('');
      setApellidoRep('');
      setTelefonoRep('');
      setMostrarFormularioManual(false);

      await fetchEstudiantes();
      if (onEstudianteAgregado) onEstudianteAgregado();
    } catch (err) {
      console.error('Error al guardar registro manual:', err);
      alert('Ocurrió un error al guardar los datos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtrado en tiempo real según el buscador
  const termino = busqueda.trim().toLowerCase();
  const estudiantesFiltrados = todosLosEstudiantes.filter(est => {
    if (!termino) return true;
    const ticketNum = (extraerTicket(est.nombre_representante) || '').toLowerCase();
    const nombreCompleto = `${est.nombre || ''} ${est.apellido || ''}`.toLowerCase();
    const repInfo = (est.nombre_representante || '').toLowerCase();
    const tel = (est.telefono_representante || '').toLowerCase();

    return nombreCompleto.includes(termino) ||
           ticketNum.includes(termino.replace('#', '')) ||
           repInfo.includes(termino) ||
           tel.includes(termino);
  });

  return (
    <div className="glass-panel" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <h2 style={{ marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <UserCheck color="var(--accent-primary)" />
        Confirmar Asistencia Rápida
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Busca por número de <strong>Ticket (#001)</strong>, <strong>Nombre</strong> o <strong>Teléfono</strong> para confirmar la llegada del niño/a con un solo clic.
      </p>

      {mensajeNotificacion && (
        <div style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e', color: '#22c55e', padding: '0.8rem 1rem', borderRadius: '8px', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
          <CheckCircle2 size={20} />
          {mensajeNotificacion}
        </div>
      )}

      {/* Buscador Rápido Principal */}
      <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
        <Search size={22} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-primary)' }} />
        <input 
          type="text" 
          value={busqueda} 
          onChange={e => setBusqueda(e.target.value)} 
          placeholder="Escribe el Ticket # (ej. 001), Nombre del niño o Representante..." 
          style={{ 
            paddingLeft: '3.2rem', 
            width: '100%', 
            paddingTop: '0.9rem', 
            paddingBottom: '0.9rem',
            background: 'var(--bg-secondary)', 
            border: '2px solid var(--accent-primary)', 
            borderRadius: '12px', 
            color: 'white', 
            fontSize: '1.05rem',
            boxShadow: '0 0 15px rgba(59, 130, 246, 0.2)'
          }}
          autoFocus
        />
        {busqueda && (
          <button 
            onClick={() => setBusqueda('')} 
            style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Resultados / Lista de Estudiantes */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Cargando lista de estudiantes...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '2rem' }}>
          {estudiantesFiltrados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px dashed var(--glass-border)' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', margin: 0 }}>
                {busqueda ? `No se encontró ningún estudiante coincidente con "${busqueda}".` : 'No hay estudiantes registrados.'}
              </p>
            </div>
          ) : (
            estudiantesFiltrados.slice(0, 15).map(est => {
              const ticketNum = extraerTicket(est.nombre_representante);
              const modoSalidaCard = extraerModoSalida(est.nombre_representante);
              const nombreRepLimpio = limpiarNombreRepresentante(est.nombre_representante);
              const edadEst = calcularEdad(est.fecha_nacimiento);
              const yaAsistioHoy = est.activo_este_domingo;

              return (
                <div 
                  key={est.id} 
                  style={{ 
                    background: yaAsistioHoy ? 'rgba(34, 197, 94, 0.08)' : 'var(--bg-secondary)', 
                    border: `1px solid ${yaAsistioHoy ? 'rgba(34, 197, 94, 0.4)' : 'var(--glass-border)'}`, 
                    borderLeft: `5px solid ${est.genero === 'Niña' ? '#ec4899' : 'var(--accent-primary)'}`,
                    borderRadius: '12px', 
                    padding: '1rem',
                    display: 'flex',
                    justify: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.8rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
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

                    <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: 'white' }}>
                      {est.nombre} {est.apellido}
                    </div>

                    <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      {edadEst > 0 ? `${edadEst} años` : ''} {est.genero ? `(${est.genero})` : ''}
                    </div>

                    {nombreRepLimpio && (
                      <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span><ShieldCheck size={14} color="#fbbf24" style={{ display: 'inline', verticalAlign: 'middle' }} /> {nombreRepLimpio}</span>
                        {est.telefono_representante && (
                          <span>| <Phone size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {est.telefono_representante}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Botón de Confirmación con 1 Clic */}
                  <div>
                    {yaAsistioHoy ? (
                      <div style={{ background: 'rgba(34, 197, 94, 0.2)', border: '1px solid #22c55e', color: '#22c55e', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <CheckCircle2 size={18} /> Asistencia Confirmada Hoy
                      </div>
                    ) : (
                      <button
                        onClick={() => handleConfirmarLlegada(est)}
                        disabled={cargandoId === est.id}
                        className="btn-primary"
                        style={{ padding: '0.65rem 1.2rem', fontSize: '0.95rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                      >
                        <UserCheck size={18} />
                        {cargandoId === est.id ? 'Confirmando...' : 'Confirmar Llegada'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Sección Desplegable para Registro Manual Excepcional */}
      <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1.2rem' }}>
        <button
          type="button"
          onClick={() => setMostrarFormularioManual(!mostrarFormularioManual)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--accent-primary)',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '0.92rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: 0
          }}
        >
          {mostrarFormularioManual ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          {mostrarFormularioManual ? 'Ocultar Formulario Manual Excepcional' : '+ Registrar manualmente a un niño sin teléfono'}
        </button>

        {mostrarFormularioManual && (
          <form onSubmit={handleGuardarManual} style={{ marginTop: '1.2rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--glass-border)', padding: '1.2rem', borderRadius: '12px', animation: 'fadeIn 0.3s ease-out' }}>
            <h3 style={{ fontSize: '1rem', color: 'white', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <User size={18} /> Registro Manual Excepcional
            </h3>

            <div className="form-responsive-row">
              <div className="form-group">
                <label>Nombre del Niño/a</label>
                <input type="text" required value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Mateo" />
              </div>
              <div className="form-group">
                <label>Apellido del Niño/a</label>
                <input type="text" required value={apellido} onChange={e => setApellido(e.target.value)} placeholder="Ej. Pérez" />
              </div>
            </div>

            <div className="form-responsive-row" style={{ alignItems: 'flex-start' }}>
              <div className="form-group">
                <label>Género</label>
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input type="radio" name="genero" value="Niño" checked={genero === 'Niño'} onChange={e => setGenero(e.target.value)} required /> Niño
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="radio" name="genero" value="Niña" checked={genero === 'Niña'} onChange={e => setGenero(e.target.value)} required /> Niña
                  </label>
                </div>
              </div>

              <div className="form-group">
                <CampoFechaNacimiento value={fechaNacimiento} onChange={setFechaNacimiento} minYear={2010} required={true} />
              </div>
            </div>

            <div className="form-group">
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white', marginBottom: '0.4rem', display: 'block' }}>
                ¿Cómo se retira el niño/a al finalizar la actividad? <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  background: modoSalida === 'Lo vienen a buscar' ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-secondary)',
                  border: `1px solid ${modoSalida === 'Lo vienen a buscar' ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                  padding: '0.65rem 0.9rem',
                  borderRadius: '8px',
                  flex: 1
                }}>
                  <input
                    type="radio"
                    name="modoSalidaAdminManual"
                    value="Lo vienen a buscar"
                    checked={modoSalida === 'Lo vienen a buscar'}
                    onChange={e => setModoSalida(e.target.value)}
                    required
                  />
                  <span><strong>Lo vienen a buscar</strong></span>
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  background: modoSalida === 'Se va solo/a' ? 'rgba(234, 179, 8, 0.2)' : 'var(--bg-secondary)',
                  border: `1px solid ${modoSalida === 'Se va solo/a' ? '#eab308' : 'var(--glass-border)'}`,
                  padding: '0.65rem 0.9rem',
                  borderRadius: '8px',
                  flex: 1
                }}>
                  <input
                    type="radio"
                    name="modoSalidaAdminManual"
                    value="Se va solo/a"
                    checked={modoSalida === 'Se va solo/a'}
                    onChange={e => setModoSalida(e.target.value)}
                    required
                  />
                  <span><strong>Se va solo/a</strong></span>
                </label>
              </div>
            </div>

            <div className="form-responsive-row">
              <div className="form-group">
                <label>Nombre del Representante (Opcional)</label>
                <input type="text" value={nombreRep} onChange={e => setNombreRep(e.target.value)} placeholder="Ej. Juan Pérez (Padre)" />
              </div>
              <div className="form-group">
                <label>Teléfono de Contacto (Opcional)</label>
                <input type="tel" value={telefonoRep} onChange={e => setTelefonoRep(e.target.value)} placeholder="04141234567" />
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting || !nombre.trim() || !apellido.trim() || !genero || !fechaNacimiento || !modoSalida}
              style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', fontWeight: 'bold', marginTop: '0.5rem' }}
            >
              {isSubmitting ? 'Guardando...' : 'Registrar Asistencia Manual'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
