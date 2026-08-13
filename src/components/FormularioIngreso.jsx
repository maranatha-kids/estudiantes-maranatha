import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search } from 'lucide-react';
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
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [genero, setGenero] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [nombreRep, setNombreRep] = useState('');
  const [apellidoRep, setApellidoRep] = useState('');
  const [telefonoRep, setTelefonoRep] = useState('');
  const [modoSalida, setModoSalida] = useState('Lo vienen a buscar');
  
  const [edad, setEdad] = useState(null);
  const [salon, setSalon] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  // Historial para autocompletado
  const [todosLosEstudiantes, setTodosLosEstudiantes] = useState([]);
  const [sugerencias, setSugerencias] = useState([]);
  const [estudianteSeleccionadoId, setEstudianteSeleccionadoId] = useState(null);

  useEffect(() => {
    // Cargar todos los estudiantes para autocompletado
    const fetchEstudiantes = async () => {
      const { data } = await supabase.from('estudiantes').select('*');
      if (data) {
        setTodosLosEstudiantes(data);
      }
    };
    fetchEstudiantes();
  }, []);

  // Evaluar edad y salón cada vez que cambia la fecha
  useEffect(() => {
    if (fechaNacimiento) {
      const e = calcularEdad(fechaNacimiento);
      setEdad(e);
      if (e >= 8 && e <= 13) {
        setSalon('Usos Múltiples');
      } else if (e > 13) {
        setSalon('Excede límite (Mayor a 13 años)');
      } else {
        setSalon('No apto (Menor de 8 años)');
      }
    } else {
      setEdad(null);
      setSalon('');
    }
  }, [fechaNacimiento]);

  const requiereRepresentante = false;

  // Manejar búsqueda
  const handleNombreChange = (e) => {
    const val = e.target.value;
    setNombre(val);
    setEstudianteSeleccionadoId(null); // Reset selection if typing

    if (val.length > 2) {
      const filtrados = todosLosEstudiantes.filter(est => 
        est.nombre.toLowerCase().includes(val.toLowerCase()) || 
        est.apellido.toLowerCase().includes(val.toLowerCase())
      );
      setSugerencias(filtrados);
    } else {
      setSugerencias([]);
    }
  };

  const seleccionarSugerencia = (est) => {
    setNombre(est.nombre);
    setApellido(est.apellido);
    setFechaNacimiento(est.fecha_nacimiento);
    setGenero(est.genero || '');
    setEstudianteSeleccionadoId(est.id);
    
    if (est.nombre_representante) setNombreRep(est.nombre_representante);
    if (est.apellido_representante) setApellidoRep(est.apellido_representante);
    if (est.telefono_representante) setTelefonoRep(est.telefono_representante);

    setSugerencias([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setMessage({ type: 'error', text: 'Por favor, ingrese el nombre del estudiante.' });
      return;
    }
    if (!apellido.trim()) {
      setMessage({ type: 'error', text: 'Por favor, ingrese el apellido del estudiante.' });
      return;
    }
    if (!genero) {
      setMessage({ type: 'error', text: 'Por favor, seleccione si es Niño o Niña.' });
      return;
    }
    if (!fechaNacimiento) {
      setMessage({ type: 'error', text: 'Por favor, ingrese la fecha de nacimiento.' });
      return;
    }
    if (edad < 8) {
      setMessage({ type: 'error', text: 'El niño debe tener al menos 8 años.' });
      return;
    }
    if (edad > 13) {
      setMessage({ type: 'error', text: 'El niño no puede tener más de 13 años (Límite: 13 años).' });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    let errorSub = null;
    let salonAnterior = null;

    if (estudianteSeleccionadoId) {
      // Guardar el salón anterior para detectar graduación
      const estAnterior = todosLosEstudiantes.find(e => e.id === estudianteSeleccionadoId);
      salonAnterior = estAnterior ? estAnterior.salon_actual : null;

      let repBase = requiereRepresentante ? nombreRep.trim() : (estAnterior?.nombre_representante || '');
      if (repBase && !repBase.toLowerCase().includes('salida:')) {
        repBase = `${repBase} (Salida: ${modoSalida})`;
      } else if (repBase && repBase.toLowerCase().includes('salida:')) {
        repBase = repBase.replace(/Salida:\s*[^)]+/i, `Salida: ${modoSalida}`);
      }

      // Estudiante ya existe, solo lo activamos para este domingo y actualizamos sus datos si cambiaron
      const dataUpdate = {
        nombre,
        apellido,
        fecha_nacimiento: fechaNacimiento,
        genero,
        salon_actual: salon,
        nombre_representante: repBase || null,
        apellido_representante: requiereRepresentante ? apellidoRep : (estAnterior?.apellido_representante || null),
        telefono_representante: requiereRepresentante ? telefonoRep : (estAnterior?.telefono_representante || null),
        activo_este_domingo: true
      };

      const { error } = await supabase
        .from('estudiantes')
        .update(dataUpdate)
        .eq('id', estudianteSeleccionadoId);
      
      errorSub = error;
    } else {
      let repBase = requiereRepresentante ? nombreRep.trim() : '';
      if (repBase && !repBase.toLowerCase().includes('salida:')) {
        repBase = `${repBase} (Salida: ${modoSalida})`;
      }

      // Es un nuevo estudiante
      const dataInsert = {
        nombre,
        apellido,
        fecha_nacimiento: fechaNacimiento,
        genero,
        salon_actual: salon,
        nombre_representante: repBase || null,
        apellido_representante: requiereRepresentante ? apellidoRep : null,
        telefono_representante: requiereRepresentante ? telefonoRep : null,
        activo_este_domingo: true
      };

      const { error } = await supabase.from('estudiantes').insert([dataInsert]);
      errorSub = error;
    }

    if (errorSub) {
      console.error(errorSub);
      setMessage({ type: 'error', text: 'Error al registrar: ' + errorSub.message });
    } else {
      setMessage({ type: 'success', text: 'Asistencia registrada correctamente.' });
      
      // Detectar graduación: si el estudiante ahora tiene 13+ años, se graduó del programa
      if (salon === 'Graduado' && salonAnterior && salonAnterior !== 'Graduado' && onGraduacion) {
        onGraduacion({ nombre: `${nombre} ${apellido}`, salonNuevo: 'Graduado' });
      }

      // Reset form
      setNombre(''); setApellido(''); setFechaNacimiento(''); setGenero('');
      setNombreRep(''); setApellidoRep(''); setTelefonoRep('');
      setEstudianteSeleccionadoId(null);
      
      if (onEstudianteAgregado) onEstudianteAgregado();
      
      // Recargar lista de estudiantes para autocompletado
      const { data } = await supabase.from('estudiantes').select('*');
      if (data) setTodosLosEstudiantes(data);

      setTimeout(() => setMessage(null), 3000);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="glass-panel">
      <h2>Registrar Asistencia</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Busca un estudiante existente o registra uno nuevo.
      </p>

      {message && (
        <div className={message.type === 'error' ? 'toast-error' : 'toast-success'}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ position: 'relative' }}>
          <label>Nombre</label>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--glass-border)', paddingRight: '10px' }}>
            <input 
              type="text" 
              required 
              value={nombre} 
              onChange={handleNombreChange} 
              placeholder="Buscar o escribir nuevo..."
              style={{ border: 'none', background: 'transparent' }}
            />
            <Search size={18} color="var(--text-secondary)" />
          </div>

          {sugerencias.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, 
              background: 'var(--glass-bg)', backdropFilter: 'blur(10px)',
              border: '1px solid var(--glass-border)', borderRadius: '8px',
              zIndex: 10, maxHeight: '200px', overflowY: 'auto', marginTop: '5px'
            }}>
              {sugerencias.map(est => (
                <div 
                  key={est.id} 
                  onClick={() => seleccionarSugerencia(est)}
                  style={{
                    padding: '10px', borderBottom: '1px solid var(--glass-border)',
                    cursor: 'pointer', transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <strong style={{ color: 'white' }}>{est.nombre} {est.apellido}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Registrado previamente en {est.salon_actual || 'Salón'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="form-group">
          <label>Apellido</label>
          <input type="text" required value={apellido} onChange={e => setApellido(e.target.value)} />
        </div>

        <div className="form-group">
          <label>Género</label>
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="radio" name="genero" value="Niño" checked={genero === 'Niño'} onChange={e => setGenero(e.target.value)} required /> Niño
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="radio" name="genero" value="Niña" checked={genero === 'Niña'} onChange={e => setGenero(e.target.value)} required /> Niña
            </label>
          </div>
        </div>

        <div className="form-group">
          <CampoFechaNacimiento 
            value={fechaNacimiento} 
            onChange={setFechaNacimiento} 
            minYear={2010} 
            required={true} 
          />
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
                name="modoSalidaAdmin"
                value="Lo vienen a buscar"
                checked={modoSalida === 'Lo vienen a buscar'}
                onChange={e => setModoSalida(e.target.value)}
                required
              />
              <span>🚗 <strong>Lo vienen a buscar</strong></span>
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
                name="modoSalidaAdmin"
                value="Se va solo/a"
                checked={modoSalida === 'Se va solo/a'}
                onChange={e => setModoSalida(e.target.value)}
                required
              />
              <span>🚶 <strong>Se va solo/a</strong></span>
            </label>
          </div>
        </div>

        {edad !== null && (
          <div style={{ padding: '1rem', background: (edad < 8 || edad > 13) ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', marginBottom: '1.5rem' }}>
            <p><strong>Edad calculada:</strong> {edad} años</p>
            <p><strong>Salón asignado:</strong> {salon}</p>
            {edad > 13 && (
              <p style={{ color: '#ef4444', marginTop: '0.5rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
                ⚠️ El niño no puede tener más de 13 años. El límite de edad permitido es de máximo 13 años.
              </p>
            )}
            {edad < 8 && (
              <p style={{ color: '#ef4444', marginTop: '0.5rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
                ⚠️ El niño debe tener al menos 8 años.
              </p>
            )}
          </div>
        )}

        {requiereRepresentante && (
          <div style={{ borderLeft: '4px solid var(--accent-primary)', paddingLeft: '1rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--accent-primary)' }}>Datos del Representante (Obligatorio)</h3>
            <div className="form-group">
              <label>Nombre del Tutor</label>
              <input type="text" required={requiereRepresentante} value={nombreRep} onChange={e => setNombreRep(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Apellido del Tutor</label>
              <input type="text" required={requiereRepresentante} value={apellidoRep} onChange={e => setApellidoRep(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Teléfono de Contacto</label>
              <input type="tel" required={requiereRepresentante} value={telefonoRep} onChange={e => setTelefonoRep(e.target.value)} />
            </div>
          </div>
        )}

        <button 
          type="submit" 
          className="btn-primary" 
          disabled={isSubmitting || !nombre.trim() || !apellido.trim() || !genero || !fechaNacimiento || (edad !== null && (edad < 8 || edad > 13))}
        >
          {isSubmitting ? 'Guardando...' : (estudianteSeleccionadoId ? 'Registrar Asistencia' : 'Registrar Nuevo Estudiante')}
        </button>
      </form>
    </div>
  );
}
