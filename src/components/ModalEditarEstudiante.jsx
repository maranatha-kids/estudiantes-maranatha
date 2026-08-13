import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Save, User, ShieldCheck, Phone, Trash2, LogOut } from 'lucide-react';
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

export default function ModalEditarEstudiante({ estudiante, onClose, onSaved }) {
  const [nombre, setNombre] = useState(estudiante.nombre || '');
  const [apellido, setApellido] = useState(estudiante.apellido || '');
  const [genero, setGenero] = useState(estudiante.genero || 'Niño');
  const [fechaNacimiento, setFechaNacimiento] = useState(estudiante.fecha_nacimiento || '');

  const parseModoSalida = (repInfo) => {
    if (!repInfo) return 'Lo vienen a buscar';
    if (repInfo.toLowerCase().includes('se va solo')) return 'Se va solo/a';
    return 'Lo vienen a buscar';
  };
  const [modoSalida, setModoSalida] = useState(parseModoSalida(estudiante.nombre_representante));

  const limpiarRep = (info) => (info || '')
    .replace(/\s*\|\s*Ticket:\s*#?\w+/i, '')
    .replace(/\s*Ticket:\s*#?\w+/i, '')
    .replace(/\s*\|\s*Salida:\s*[^)]+/i, '')
    .replace(/\s*Salida:\s*[^)]+/i, '')
    .trim();
  const [nombreRep, setNombreRep] = useState(limpiarRep(estudiante.nombre_representante));
  const parseTelefono = (tel) => {
    const raw = (tel || '').replace(/\D/g, '');
    const codigosValidos = ['0414', '0424', '0412', '0422', '0416', '0426'];
    const prefix = codigosValidos.find(c => raw.startsWith(c));
    if (prefix) {
      return { codigo: prefix, numero: raw.slice(4, 11) };
    }
    if (raw.startsWith('04') && raw.length >= 4) {
      return { codigo: raw.slice(0, 4), numero: raw.slice(4, 11) };
    }
    return { codigo: '0414', numero: raw.slice(0, 7) };
  };

  const initialTel = parseTelefono(estudiante.telefono_representante);
  const [codigoTelefono, setCodigoTelefono] = useState(initialTel.codigo);
  const [numeroTelefono, setNumeroTelefono] = useState(initialTel.numero);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [mostrarConfirmarEliminar, setMostrarConfirmarEliminar] = useState(false);

  const handleEliminarDefinitivo = async () => {
    setIsSubmitting(true);
    const { error } = await supabase.from('estudiantes').delete().eq('id', estudiante.id);
    if (error) {
      setErrorMsg('Error al eliminar estudiante: ' + error.message);
      setIsSubmitting(false);
    } else {
      onSaved();
      onClose();
    }
  };

  const hoyObj = new Date();
  const fechaHoy = `${hoyObj.getFullYear()}-${String(hoyObj.getMonth() + 1).padStart(2, '0')}-${String(hoyObj.getDate()).padStart(2, '0')}`;
  const edadCalculada = calcularEdad(fechaNacimiento);

  const handleTelefonoChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length === 0) {
      setTelefonoRep('04');
      return;
    }
    if (!val.startsWith('04')) {
      if (val.startsWith('4')) {
        val = '0' + val;
      } else {
        val = '04' + val;
      }
    }
    if (val.length > 11) {
      val = val.slice(0, 11);
    }
    setTelefonoRep(val);
  };

  const extraerTicketOriginal = (repInfo) => {
    if (!repInfo) return null;
    const match = repInfo.match(/Ticket:\s*#?([0-9A-Za-z]+)/i);
    return match ? match[1] : null;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      if (!nombre.trim()) {
        setErrorMsg('Por favor, ingrese el nombre del estudiante.');
        setIsSubmitting(false);
        return;
      }
      if (!apellido.trim()) {
        setErrorMsg('Por favor, ingrese el apellido del estudiante.');
        setIsSubmitting(false);
        return;
      }
      if (!genero) {
        setErrorMsg('Por favor, seleccione el género (Niño o Niña).');
        setIsSubmitting(false);
        return;
      }
      if (!fechaNacimiento) {
        setErrorMsg('Por favor, ingrese la fecha de nacimiento.');
        setIsSubmitting(false);
        return;
      }
      if (!nombreRep.trim()) {
        setErrorMsg('Por favor, ingrese la información del representante.');
        setIsSubmitting(false);
        return;
      }
      if (edadCalculada < 8) {
        setErrorMsg('El estudiante debe tener al menos 8 años.');
        setIsSubmitting(false);
        return;
      }
      if (edadCalculada > 13) {
        setErrorMsg('El estudiante no puede tener más de 13 años (Límite permitido: 13 años).');
        setIsSubmitting(false);
        return;
      }

      if (numeroTelefono && numeroTelefono.length !== 7) {
        setErrorMsg('El número de teléfono debe tener los 7 dígitos completos después del código (Ej. 0414 + 1234567).');
        setIsSubmitting(false);
        return;
      }

      const telefonoFinal = numeroTelefono ? `${codigoTelefono}${numeroTelefono}` : '';
      const salonAsignado = 'Usos Múltiples';

      // Preservar el ticket original si existía
      const ticketOriginal = extraerTicketOriginal(estudiante.nombre_representante);
      let nombreRepFinal = nombreRep.trim();
      if (ticketOriginal && !nombreRepFinal.toLowerCase().includes('ticket:')) {
        nombreRepFinal = `${nombreRepFinal} (Ticket: #${ticketOriginal} | Salida: ${modoSalida})`;
      } else if (!nombreRepFinal.toLowerCase().includes('salida:')) {
        nombreRepFinal = `${nombreRepFinal} (Salida: ${modoSalida})`;
      } else {
        nombreRepFinal = nombreRepFinal.replace(/Salida:\s*[^)]+/i, `Salida: ${modoSalida}`);
      }

      const { error } = await supabase
        .from('estudiantes')
        .update({
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          genero: genero,
          fecha_nacimiento: fechaNacimiento,
          salon_actual: salonAsignado,
          nombre_representante: nombreRepFinal,
          telefono_representante: telefonoFinal
        })
        .eq('id', estudiante.id);

      if (error) throw error;

      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Error al guardar los cambios: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '520px',
        width: '100%',
        position: 'relative',
        border: '2px solid var(--accent-primary)',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.8rem' }}>
          <h2 style={{ fontSize: '1.4rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
            <User color="var(--accent-primary)" size={24} /> Editar Datos del Estudiante
          </h2>
          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={24} />
          </button>
        </div>

        {errorMsg && (
          <div className="toast-error" style={{ marginBottom: '1rem' }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSave}>
          {/* Datos del Niño */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: '12px', marginBottom: '1.2rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--accent-primary)', marginBottom: '0.8rem' }}>
              Datos del Niño / Niña
            </h3>

            <div className="form-responsive-row">
              <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                <label style={{ fontSize: '0.85rem' }}>Nombre</label>
                <input 
                  type="text" 
                  required 
                  value={nombre} 
                  onChange={e => setNombre(e.target.value)} 
                />
              </div>

              <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                <label style={{ fontSize: '0.85rem' }}>Apellido</label>
                <input 
                  type="text" 
                  required 
                  value={apellido} 
                  onChange={e => setApellido(e.target.value)} 
                />
              </div>
            </div>

            <div className="form-responsive-row">
              <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                <label style={{ fontSize: '0.85rem' }}>Género</label>
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.4rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input 
                      type="radio" 
                      name="generoModal" 
                      value="Niño" 
                      checked={genero === 'Niño'} 
                      onChange={e => setGenero(e.target.value)} 
                    /> Niño
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input 
                      type="radio" 
                      name="generoModal" 
                      value="Niña" 
                      checked={genero === 'Niña'} 
                      onChange={e => setGenero(e.target.value)} 
                    /> Niña
                  </label>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <CampoFechaNacimiento 
                  value={fechaNacimiento} 
                  onChange={setFechaNacimiento} 
                  minYear={2010} 
                  required={true} 
                />
              </div>
            </div>

            {fechaNacimiento && (
              <div style={{ marginTop: '0.8rem', padding: '0.5rem', background: (edadCalculada < 8 || edadCalculada > 13) ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.1)', borderRadius: '6px', fontSize: '0.85rem' }}>
                Edad calculada: <strong>{edadCalculada} años</strong> | Salón: <strong>{edadCalculada > 13 ? '❌ Excede límite (Máx. 13 años)' : (edadCalculada >= 8 ? 'Usos Múltiples' : 'Menor de 8 años')}</strong>
              </div>
            )}
          </div>

          {/* Datos del Representante */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: '12px', marginBottom: '1.2rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--accent-primary)', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ShieldCheck size={18} /> Datos del Representante
            </h3>

            <div className="form-group" style={{ marginBottom: '0.8rem' }}>
              <label style={{ fontSize: '0.85rem' }}>Nombre / Información Representante</label>
              <input 
                type="text" 
                value={nombreRep} 
                onChange={e => setNombreRep(e.target.value)} 
                placeholder="Ej. Juan Pérez (Padre)"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '0.85rem' }}>Teléfono de Contacto</label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <select 
                  value={codigoTelefono} 
                  onChange={e => setCodigoTelefono(e.target.value)}
                  style={{ width: '95px', minWidth: '95px', flexShrink: 0, padding: '0.65rem 0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'white', fontSize: '0.95rem', fontWeight: 'bold' }}
                >
                  <option value="0414">0414</option>
                  <option value="0424">0424</option>
                  <option value="0412">0412</option>
                  <option value="0422">0422</option>
                  <option value="0416">0416</option>
                  <option value="0426">0426</option>
                </select>
                <input 
                  type="tel" 
                  maxLength={7}
                  value={numeroTelefono} 
                  onChange={e => setNumeroTelefono(e.target.value.replace(/\D/g, '').slice(0, 7))} 
                  placeholder="1234567"
                  style={{ flex: 1, width: '100%', padding: '0.65rem 0.8rem', fontSize: '0.95rem', letterSpacing: '0.5px' }}
                />
              </div>
            </div>
          </div>

          {/* Modo de Salida / Retiro */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: '12px', marginBottom: '1.2rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--accent-primary)', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <LogOut size={18} /> Modo de Salida / Retiro <span style={{ color: '#ef4444' }}>*</span>
            </h3>

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
                  name="modoSalidaEdit" 
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
                  name="modoSalidaEdit" 
                  value="Se va solo/a" 
                  checked={modoSalida === 'Se va solo/a'} 
                  onChange={e => setModoSalida(e.target.value)} 
                  required 
                />
                <span>🚶 <strong>Se va solo/a</strong></span>
              </label>
            </div>
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setMostrarConfirmarEliminar(true)}
              style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '0.75rem 1rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}
            >
              <Trash2 size={16} /> Eliminar Estudiante
            </button>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                type="button" 
                onClick={onClose}
                style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', padding: '0.75rem 1.2rem', borderRadius: '8px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="btn-primary" 
                disabled={isSubmitting}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'auto', padding: '0.75rem 1.5rem', marginTop: 0 }}
              >
                <Save size={18} /> {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </form>

        {/* Modal de confirmación para eliminar estudiante permanentemente */}
        {mostrarConfirmarEliminar && (
          <ModalConfirmacion 
            titulo="¿Eliminar Estudiante Definitivamente?"
            mensaje={`¿Estás seguro de que deseas eliminar permanentemente a ${nombre} ${apellido} del sistema?`}
            textoBotonConfirmar="Sí, Eliminar Definitivamente"
            onCancelar={() => setMostrarConfirmarEliminar(false)}
            onConfirmar={handleEliminarDefinitivo}
            isCargando={isSubmitting}
          />
        )}
      </div>
    </div>
  );
}
