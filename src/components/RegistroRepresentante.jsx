import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Sparkles, User, ShieldCheck, Heart, Plus, AlertCircle, ChevronLeft, LogOut } from 'lucide-react';
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

// Validar que el teléfono sea verosímil y no un placeholder ficticio (ej: 0000000, 1111111, 1234567)
function esTelefonoValido(codigo, numero) {
  if (!numero || numero.length !== 7) return false;
  // Descartar si son todos ceros (ej: 04240000000)
  if (numero === '0000000') return false;
  // Descartar si los 7 dígitos son idénticos (ej: 1111111, 2222222, 9999999)
  if (/^(\d)\1{6}$/.test(numero)) return false;
  // Descartar números de prueba comunes
  if (numero === '1234567' || numero === '7654321' || numero === '0123456') return false;
  // Exigir al menos 3 dígitos únicos para ser un número real
  const digitosUnicos = new Set(numero.split('')).size;
  if (digitosUnicos < 3) return false;
  return true;
}

function extraerDatosRepresentante(estudiante) {
  let repStr = estudiante.nombre_representante || '';
  let parentesco = 'Padre';
  let salida = 'Lo vienen a buscar';

  if (repStr.toLowerCase().includes('se va solo')) salida = 'Se va solo/a';

  const matchParentesco = repStr.match(/\((Padre|Madre|Abuelo\/a|Tío\/a|Hermano\/a|Tutor Legal|Otro)/i);
  if (matchParentesco) {
    parentesco = matchParentesco[1].trim();
  }

  let nombreLimpio = repStr
    .replace(/\([^)]*\)/g, '')
    .replace(/Ticket:\s*#?\w+/gi, '')
    .replace(/Salida:\s*[^)]+/gi, '')
    .trim();

  let nombre = '';
  let apellido = estudiante.apellido_representante ? estudiante.apellido_representante.trim() : '';

  if (nombreLimpio) {
    const partes = nombreLimpio.split(/\s+/);
    if (!apellido && partes.length > 1) {
      nombre = partes[0];
      apellido = partes.slice(1).join(' ');
    } else if (!apellido) {
      nombre = partes[0] || '';
    } else {
      nombre = partes[0] || '';
    }
  }

  return {
    nombre: nombre || '',
    apellido: apellido || '',
    parentesco: parentesco || 'Padre',
    modoSalida: salida
  };
}

export default function RegistroRepresentante({ onVolverAlPanel, esPublico = false }) {
  // Datos del representante
  const [nombreRep, setNombreRep] = useState('');
  const [apellidoRep, setApellidoRep] = useState('');
  const [codigoTelefono, setCodigoTelefono] = useState('0414');
  const [numeroTelefono, setNumeroTelefono] = useState('');
  const [parentescoRep, setParentescoRep] = useState('Padre');
  const [otroParentesco, setOtroParentesco] = useState('');

  const telefonoRep = `${codigoTelefono}${numeroTelefono}`;

  // Datos del niño/a
  const [nombreEst, setNombreEst] = useState('');
  const [apellidoEst, setApellidoEst] = useState('');
  const [generoEst, setGeneroEst] = useState('');
  const [fechaNacimientoEst, setFechaNacimientoEst] = useState('');
  const [modoSalida, setModoSalida] = useState('Lo vienen a buscar');

  // Estado del proceso
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [ticketGuardado, setTicketGuardado] = useState(null);
  const [isSalonLleno, setIsSalonLleno] = useState(false);

  // Búsqueda inteligente por teléfono en Supabase (solo números reales)
  const [isBuscandoTelefono, setIsBuscandoTelefono] = useState(false);
  const [estudiantesPreviosEncontrados, setEstudiantesPreviosEncontrados] = useState([]);
  const [representanteEncontrado, setRepresentanteEncontrado] = useState(null);
  const [ninoSeleccionadoId, setNinoSeleccionadoId] = useState(null);

  useEffect(() => {
    comprobarCapacidad();
  }, []);

  // Efecto para buscar automáticamente en la nube cuando el teléfono es real y completo
  useEffect(() => {
    if (numeroTelefono.length === 7 && esTelefonoValido(codigoTelefono, numeroTelefono)) {
      buscarDatosPorTelefono(codigoTelefono, numeroTelefono);
    } else {
      setEstudiantesPreviosEncontrados([]);
      setRepresentanteEncontrado(null);
    }
  }, [codigoTelefono, numeroTelefono]);

  const buscarDatosPorTelefono = async (codigo, numero) => {
    const tel = `${codigo}${numero}`;
    setIsBuscandoTelefono(true);
    try {
      const { data, error } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('telefono_representante', tel)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const datosRep = extraerDatosRepresentante(data[0]);
        setRepresentanteEncontrado(datosRep);

        // Autocompletar datos del representante si los campos estaban vacíos o para agilizar
        setNombreRep(prev => prev.trim() ? prev : datosRep.nombre);
        setApellidoRep(prev => prev.trim() ? prev : datosRep.apellido);
        if (datosRep.parentesco && ['Padre', 'Madre', 'Abuelo/a', 'Tío/a', 'Hermano/a', 'Tutor Legal'].includes(datosRep.parentesco)) {
          setParentescoRep(prev => prev || datosRep.parentesco);
        }

        // Obtener lista de niños únicos asociados a este teléfono
        const ninosUnicos = [];
        data.forEach(est => {
          const yaEsta = ninosUnicos.some(
            n => n.nombre.toLowerCase().trim() === est.nombre.toLowerCase().trim() && 
                 n.apellido.toLowerCase().trim() === est.apellido.toLowerCase().trim()
          );
          if (!yaEsta) {
            ninosUnicos.push(est);
          }
        });
        setEstudiantesPreviosEncontrados(ninosUnicos);
      } else {
        setEstudiantesPreviosEncontrados([]);
        setRepresentanteEncontrado(null);
      }
    } catch (err) {
      console.error('Error al buscar datos por teléfono:', err);
    } finally {
      setIsBuscandoTelefono(false);
    }
  };

  const handleSeleccionarNinoPrevio = (est) => {
    setNinoSeleccionadoId(est.id);
    setNombreEst(est.nombre || '');
    setApellidoEst(est.apellido || '');
    setGeneroEst(est.genero || 'Niño');
    setFechaNacimientoEst(est.fecha_nacimiento || '');

    const modoPrevio = (est.nombre_representante || '').toLowerCase().includes('se va solo')
      ? 'Se va solo/a'
      : 'Lo vienen a buscar';
    setModoSalida(modoPrevio);
  };

  const comprobarCapacidad = async () => {
    try {
      const { count, error } = await supabase
        .from('estudiantes')
        .select('*', { count: 'exact', head: true })
        .eq('activo_este_domingo', true);

      if (!error && count >= 300) {
        setIsSalonLleno(true);
      }
    } catch (err) {
      console.error('Error al comprobar capacidad:', err);
    }
  };

  // Generar número de ticket único para el día activo (se reinicia al cerrar el día)
  // Ignora estudiantes graduados para que los no graduados comiencen desde 001
  const generarTicket = async () => {
    try {
      // Consultar únicamente los estudiantes activos el día de HOY
      const { data: activos, error } = await supabase
        .from('estudiantes')
        .select('nombre_representante, fecha_nacimiento, salon_actual')
        .eq('activo_este_domingo', true);

      if (error) throw error;

      // Filtrar ignorando a los estudiantes que ya se han graduado
      const noGraduados = (activos || []).filter(e => {
        if (e.salon_actual === 'Graduado') return false;
        if (e.fecha_nacimiento && calcularEdad(e.fecha_nacimiento) > 12) return false;
        return true;
      });

      let maxTicketHoy = 0;
      noGraduados.forEach(e => {
        if (e.nombre_representante) {
          const match = e.nombre_representante.match(/Ticket:\s*#?(\d+)/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxTicketHoy) maxTicketHoy = num;
          }
        }
      });

      const siguiente = maxTicketHoy + 1;
      return String(siguiente).padStart(3, '0');
    } catch (err) {
      console.error('Error al generar ticket del día:', err);
      return '001';
    }
  };

  const edad = calcularEdad(fechaNacimientoEst);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!nombreRep.trim()) {
      setErrorMsg('Por favor, ingrese el nombre del representante.');
      return;
    }

    if (!apellidoRep.trim()) {
      setErrorMsg('Por favor, ingrese el apellido del representante.');
      return;
    }

    if (numeroTelefono.length !== 7) {
      setErrorMsg('El número de teléfono debe tener los 7 dígitos completos después del código seleccionado (Ej. 0414 + 1234567).');
      return;
    }

    if (parentescoRep === 'Otro' && !otroParentesco.trim()) {
      setErrorMsg('Por favor, especifique el parentesco con el niño/a.');
      return;
    }

    if (!nombreEst.trim()) {
      setErrorMsg('Por favor, ingrese el nombre del niño/a.');
      return;
    }

    if (!apellidoEst.trim()) {
      setErrorMsg('Por favor, ingrese el apellido del niño/a.');
      return;
    }

    if (!generoEst) {
      setErrorMsg('Por favor, seleccione si es Niño o Niña.');
      return;
    }

    if (!fechaNacimientoEst) {
      setErrorMsg('Por favor, seleccione la fecha de nacimiento del niño/a.');
      return;
    }

    if (edad < 8) {
      setErrorMsg('El niño debe tener al menos 8 años para ser registrado en las actividades de Maranatha Kids.');
      return;
    }

    setIsSubmitting(true);

    try {
      const parentescoFinal = parentescoRep === 'Otro' ? otroParentesco : parentescoRep;
      const esGraduado = edad > 12;
      const salonAsignado = esGraduado ? 'Graduado' : 'Usos Múltiples';

      // Buscar si el niño ya existía previamente por Nombre y Apellido
      const { data: existencias } = await supabase
        .from('estudiantes')
        .select('*')
        .ilike('nombre', nombreEst.trim())
        .ilike('apellido', apellidoEst.trim());

      let estudianteExistente = existencias && existencias.length > 0 ? existencias[0] : null;

      // Si no es graduado, verificar capacidad máxima de 300 estudiantes activos
      if (!esGraduado) {
        const { count: totalActivosHoy } = await supabase
          .from('estudiantes')
          .select('*', { count: 'exact', head: true })
          .eq('activo_este_domingo', true);

        if ((!estudianteExistente || !estudianteExistente.activo_este_domingo) && totalActivosHoy >= 300) {
          setIsSalonLleno(true);
          setErrorMsg('El salón de Usos Múltiples ha alcanzado su capacidad máxima (300 estudiantes). El salón está lleno.');
          setIsSubmitting(false);
          return;
        }
      }

      // Solo los estudiantes NO graduados reciben ticket (iniciando desde 001)
      let numTicketCalculado = null;
      let infoRepresentanteFormateada = '';

      if (esGraduado) {
        infoRepresentanteFormateada = `${nombreRep.trim()} ${apellidoRep.trim()} (${parentescoFinal} | Graduado/a | Salida: ${modoSalida})`;
      } else {
        numTicketCalculado = await generarTicket();
        infoRepresentanteFormateada = `${nombreRep.trim()} ${apellidoRep.trim()} (${parentescoFinal} | Ticket: #${numTicketCalculado} | Salida: ${modoSalida})`;
      }

      let targetId = null;

      if (estudianteExistente) {
        targetId = estudianteExistente.id;
        const { error: errUpdate } = await supabase
          .from('estudiantes')
          .update({
            fecha_nacimiento: fechaNacimientoEst,
            genero: generoEst,
            salon_actual: salonAsignado,
            nombre_representante: infoRepresentanteFormateada,
            apellido_representante: apellidoRep.trim(),
            telefono_representante: telefonoRep.trim(),
            activo_este_domingo: !esGraduado
          })
          .eq('id', estudianteExistente.id);

        if (errUpdate) throw errUpdate;
      } else {
        // Crear nuevo registro
        const { data: inserted, error: errInsert } = await supabase
          .from('estudiantes')
          .insert([{
            nombre: nombreEst.trim(),
            apellido: apellidoEst.trim(),
            fecha_nacimiento: fechaNacimientoEst,
            genero: generoEst,
            salon_actual: salonAsignado,
            nombre_representante: infoRepresentanteFormateada,
            apellido_representante: apellidoRep.trim(),
            telefono_representante: telefonoRep.trim(),
            activo_este_domingo: !esGraduado
          }])
          .select();

        if (errInsert) throw errInsert;
        if (inserted && inserted.length > 0) {
          targetId = inserted[0].id;
        }
      }

      // --- VERIFICACIÓN Y PROTECCIÓN ANTI-COLISIÓN SIMULTÁNEA (SOLO PARA NO GRADUADOS CON TICKET) ---
      if (!esGraduado && targetId && numTicketCalculado) {
        const { data: todosActivosHoy } = await supabase
          .from('estudiantes')
          .select('id, nombre_representante, telefono_representante, fecha_nacimiento, salon_actual')
          .eq('activo_este_domingo', true);

        // Buscar si otro estudiante activo no graduado ya tiene asignado el mismo ticket
        const duplicadosEncontrados = (todosActivosHoy || []).filter(e => {
          if (e.id === targetId) return false;
          if (e.salon_actual === 'Graduado') return false;
          if (e.fecha_nacimiento && calcularEdad(e.fecha_nacimiento) > 12) return false;
          const match = (e.nombre_representante || '').match(/Ticket:\s*#?(\d+)/i);
          return match && match[1] === numTicketCalculado;
        });

        if (duplicadosEncontrados.length > 0) {
          // Recalcular en tiempo real el ticket más alto del día para resolver colisión
          let maxColision = parseInt(numTicketCalculado, 10);
          (todosActivosHoy || []).forEach(e => {
            if (e.salon_actual !== 'Graduado' && (!e.fecha_nacimiento || calcularEdad(e.fecha_nacimiento) <= 12)) {
              const match = (e.nombre_representante || '').match(/Ticket:\s*#?(\d+)/i);
              if (match) {
                const n = parseInt(match[1], 10);
                if (n > maxColision) maxColision = n;
              }
            }
          });
          numTicketCalculado = String(maxColision + 1).padStart(3, '0');
          infoRepresentanteFormateada = `${nombreRep.trim()} ${apellidoRep.trim()} (${parentescoFinal} | Ticket: #${numTicketCalculado} | Salida: ${modoSalida})`;

          // Actualizar inmediatamente en Supabase con el ticket corregido único
          await supabase
            .from('estudiantes')
            .update({ nombre_representante: infoRepresentanteFormateada })
            .eq('id', targetId);
        }
      }

      // Guardar ticket para mostrar en pantalla al representante
      setTicketGuardado({
        ticket: esGraduado ? 'GRADUADO' : numTicketCalculado,
        esGraduado: esGraduado,
        nino: `${nombreEst.trim()} ${apellidoEst.trim()}`,
        representante: `${nombreRep.trim()} ${apellidoRep.trim()}`,
        parentesco: parentescoFinal,
        telefono: telefonoRep.trim(),
        salon: salonAsignado,
        edad: edad,
        modoSalida: modoSalida
      });

    } catch (err) {
      console.error(err);
      setErrorMsg('Ocurrió un error al guardar los datos: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegistrarOtroNino = () => {
    setTicketGuardado(null);
    setNombreEst('');
    setApellidoEst('');
    setGeneroEst('');
    setFechaNacimientoEst('');
    setModoSalida('Lo vienen a buscar');

    // Si es el formulario utilizado por los servidores (esPublico === false):
    // Limpiar absolutamente todos los campos del representante a blanco para el nuevo representante
    if (!esPublico) {
      setNombreRep('');
      setApellidoRep('');
      setCodigoTelefono('0414');
      setNumeroTelefono('');
      setParentescoRep('Padre');
      setOtroParentesco('');
    }
  };

  // VISTA TICKET DE CONFIRMACIÓN (SOLO PARA REPRESENTANTE)
  if (ticketGuardado) {
    return (
      <div style={{ maxWidth: '500px', margin: '1rem auto', padding: '0 0.5rem', animation: 'fadeIn 0.4s ease-out' }}>
        <div className="glass-panel" style={{ textAlign: 'center', position: 'relative', overflow: 'hidden', border: '2px solid var(--accent-primary)', padding: '1.5rem 1rem' }}>
          <div style={{ background: 'var(--accent-gradient)', padding: '1.2rem 1rem', margin: '-1.5rem -1rem 1.2rem -1rem', color: 'white' }}>
            <Sparkles size={32} style={{ marginBottom: '0.4rem' }} />
            <h2 style={{ fontSize: '1.6rem', margin: 0 }}>¡Registro Exitoso!</h2>
            <p style={{ margin: '0.3rem 0 0 0', opacity: 0.9, fontSize: '0.9rem' }}>Maranatha Kids</p>
          </div>

          {ticketGuardado.esGraduado ? (
            <div style={{ background: 'rgba(234, 179, 8, 0.15)', border: '2px dashed #eab308', borderRadius: '16px', padding: '1.2rem 0.8rem', marginBottom: '1.2rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#fef08a', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
                Registro de Graduado
              </span>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#eab308', textShadow: '0 0 20px rgba(234,179,8,0.5)', margin: '0.4rem 0' }}>
                🎓 Graduado/a
              </div>
              <p style={{ color: 'white', fontWeight: '500', fontSize: '0.95rem', margin: 0, lineHeight: 1.4 }}>
                Este estudiante tiene más de 12 años y ha sido archivado en el módulo de <strong>Graduados</strong>. Los niños activos continúan guardándose desde el número <strong>#001</strong>.
              </p>
            </div>
          ) : (
            <div style={{ background: 'rgba(59, 130, 246, 0.15)', border: '2px dashed var(--accent-primary)', borderRadius: '16px', padding: '1.2rem 0.8rem', marginBottom: '1.2rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
                Número de Turno / Ticket
              </span>
              <div style={{ fontSize: '3.2rem', fontWeight: 900, color: 'var(--accent-primary)', textShadow: '0 0 20px rgba(59,130,246,0.5)', margin: '0.4rem 0' }}>
                #{ticketGuardado.ticket}
              </div>
              <p style={{ color: 'white', fontWeight: '500', fontSize: '0.95rem', margin: 0, lineHeight: 1.4 }}>
                Muestra este número al recepcionista en la entrada para confirmar la llegada.
              </p>
            </div>
          )}

          <div style={{ textAlign: 'left', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '12px', marginBottom: '1.2rem', fontSize: '0.9rem' }}>
            <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.4rem', marginBottom: '0.6rem', color: 'var(--accent-primary)', fontSize: '1rem' }}>
              Datos Registrados:
            </h3>
            <p style={{ margin: '0.3rem 0' }}><strong>Niño/a:</strong> {ticketGuardado.nino} ({ticketGuardado.edad} años)</p>
            <p style={{ margin: '0.3rem 0' }}><strong>Representante:</strong> {ticketGuardado.representante}</p>
            <p style={{ margin: '0.3rem 0' }}><strong>Parentesco:</strong> {ticketGuardado.parentesco}</p>
            <p style={{ margin: '0.3rem 0' }}><strong>Teléfono:</strong> {ticketGuardado.telefono}</p>
            <p style={{ margin: '0.3rem 0' }}><strong>Modo de Salida:</strong> {ticketGuardado.modoSalida === 'Se va solo/a' ? 'Se va solo/a' : 'Lo vienen a buscar'}</p>
            <p style={{ margin: '0.3rem 0' }}><strong>Estado:</strong> {ticketGuardado.salon === 'Graduado' ? 'Graduado' : ticketGuardado.salon}</p>
          </div>

          <button 
            onClick={handleRegistrarOtroNino} 
            className="btn-primary" 
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '0.85rem', fontSize: '1rem' }}
          >
            <Plus size={20} /> {esPublico ? 'Registrar otro niño/a' : 'Nuevo Registro'}
          </button>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            {esPublico 
              ? '* Se mantendrán tus datos de representante para registrar a tus otros hijos de forma rápida.' 
              : '* Se limpiarán todos los campos para registrar un nuevo representante desde cero.'
            }
          </p>
        </div>
      </div>
    );
  }

  const hoyObj = new Date();
  const fechaHoy = `${hoyObj.getFullYear()}-${String(hoyObj.getMonth() + 1).padStart(2, '0')}-${String(hoyObj.getDate()).padStart(2, '0')}`;

  return (
    <div style={{ maxWidth: '500px', margin: '1rem auto', padding: '0 0.5rem', animation: 'fadeIn 0.3s ease-out' }}>
      {onVolverAlPanel && (
        <button 
          onClick={onVolverAlPanel}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 600 }}
        >
          <ChevronLeft size={20} /> Volver al Panel Principal
        </button>
      )}

      <div className="glass-panel" style={{ padding: '1.25rem 1rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'inline-flex', padding: '10px', background: 'rgba(59, 130, 246, 0.15)', borderRadius: '50%', marginBottom: '0.6rem' }}>
            <Heart size={28} color="var(--accent-primary)" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, lineHeight: 1.2 }}>Registro de Representante</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.4rem', fontSize: '0.85rem', lineHeight: 1.4 }}>
            Maranatha Kids — Ingrese sus datos y los del niño/a para obtener su número de turno.
          </p>
        </div>

        {isSalonLleno && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '2px solid #ef4444', color: '#ef4444', padding: '1rem', borderRadius: '12px', marginBottom: '1.2rem', textAlign: 'center', fontWeight: 'bold' }}>
            ⚠️ Capacidad Máxima Alcanzada (300 Estudiantes)
            <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.88rem', color: 'white', fontWeight: 'normal' }}>
              El salón de Usos Múltiples ha alcanzado su límite máximo de 300 estudiantes para el día de hoy. El salón está lleno.
            </p>
          </div>
        )}

        {errorMsg && (
          <div className="toast-error" style={{ marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <AlertCircle size={20} /> {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* SECCIÓN 1: DATOS DEL REPRESENTANTE */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: '12px', marginBottom: '1.2rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--accent-primary)', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ShieldCheck size={18} /> Datos del Representante
            </h3>

            {/* Teléfono primero para autocompletar automáticamente datos previos de números reales */}
            <div className="form-group" style={{ marginBottom: '0.8rem' }}>
              <label style={{ fontSize: '0.85rem' }}>Teléfono de Contacto <span style={{ color: '#ef4444' }}>*</span></label>
              <div style={{ display: 'flex', gap: '0.4rem', width: '100%' }}>
                <select 
                  value={codigoTelefono} 
                  onChange={e => setCodigoTelefono(e.target.value)}
                  style={{ width: '85px', minWidth: '85px', flexShrink: 0, padding: '0.65rem 0.3rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'white', fontSize: '0.9rem', fontWeight: 'bold' }}
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
                  required 
                  maxLength={7}
                  value={numeroTelefono} 
                  onChange={e => setNumeroTelefono(e.target.value.replace(/\D/g, '').slice(0, 7))} 
                  placeholder="1234567" 
                  style={{ flex: 1, minWidth: 0, width: '100%', padding: '0.65rem 0.6rem', fontSize: '0.95rem', letterSpacing: '0.5px' }}
                />
              </div>
              {numeroTelefono.length !== 7 ? (
                <span style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.25rem', display: 'block', fontWeight: 'bold' }}>
                  {numeroTelefono.length === 0 ? '⚠️ Falta completar este campo' : `⚠️ Falta completar este campo (${numeroTelefono.length}/7 dígitos)`}
                </span>
              ) : isBuscandoTelefono ? (
                <span style={{ color: 'var(--accent-primary)', fontSize: '0.8rem', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Sparkles size={14} /> Buscando datos registrados anteriormente...
                </span>
              ) : representanteEncontrado ? (
                <span style={{ color: '#4ade80', fontSize: '0.8rem', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: '500' }}>
                  ✓ ¡Registro anterior encontrado! Datos autocompletados.
                </span>
              ) : null}
            </div>

            <div className="form-responsive-row">
              <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                <label style={{ fontSize: '0.85rem' }}>Nombre del Representante <span style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  type="text" 
                  required 
                  value={nombreRep} 
                  onChange={e => setNombreRep(e.target.value)} 
                  placeholder="Ej. Juan" 
                  style={{ padding: '0.65rem 0.8rem', fontSize: '0.95rem' }}
                />
                {!nombreRep.trim() && (
                  <span style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.25rem', display: 'block', fontWeight: 'bold' }}>
                    ⚠️ Falta completar este campo
                  </span>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                <label style={{ fontSize: '0.85rem' }}>Apellido del Representante <span style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  type="text" 
                  required 
                  value={apellidoRep} 
                  onChange={e => setApellidoRep(e.target.value)} 
                  placeholder="Ej. Pérez" 
                  style={{ padding: '0.65rem 0.8rem', fontSize: '0.95rem' }}
                />
                {!apellidoRep.trim() && (
                  <span style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.25rem', display: 'block', fontWeight: 'bold' }}>
                    ⚠️ Falta completar este campo
                  </span>
                )}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '0.85rem' }}>Parentesco con el niño/a <span style={{ color: '#ef4444' }}>*</span></label>
              <select 
                value={parentescoRep} 
                onChange={e => setParentescoRep(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.8rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'white', fontSize: '0.95rem' }}
              >
                <option value="Padre">Padre</option>
                <option value="Madre">Madre</option>
                <option value="Abuelo/a">Abuelo / Abuela</option>
                <option value="Tío/a">Tío / Tía</option>
                <option value="Hermano/a">Hermano / Hermana</option>
                <option value="Tutor Legal">Tutor Legal</option>
                <option value="Otro">Otro...</option>
              </select>

              {parentescoRep === 'Otro' && (
                <>
                  <input 
                    type="text" 
                    required 
                    value={otroParentesco} 
                    onChange={e => setOtroParentesco(e.target.value)} 
                    placeholder="Escriba su parentesco" 
                    style={{ marginTop: '0.5rem', padding: '0.65rem 0.8rem', fontSize: '0.95rem' }}
                  />
                  {!otroParentesco.trim() && (
                    <span style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.25rem', display: 'block', fontWeight: 'bold' }}>
                      ⚠️ Falta completar este campo
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* SECCIÓN 2: DATOS DEL NIÑO */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: '12px', marginBottom: '1.2rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--accent-primary)', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <User size={18} /> Datos del Niño / Niña
            </h3>

            {/* Selector Rápido de Niños Encontrados por Teléfono Real */}
            {estudiantesPreviosEncontrados.length > 0 && (
              <div style={{
                background: 'rgba(59, 130, 246, 0.12)',
                border: '1px solid var(--accent-primary)',
                borderRadius: '10px',
                padding: '0.8rem',
                marginBottom: '1rem',
                animation: 'fadeIn 0.3s ease-out'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#93c5fd', fontWeight: 'bold', fontSize: '0.88rem', marginBottom: '0.3rem' }}>
                  <Sparkles size={16} color="var(--accent-primary)" />
                  Niños registrados anteriormente con este teléfono:
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0 0 0.5rem 0' }}>
                  Toca a tu niño/a para rellenar sus datos automáticamente sin escribir:
                </p>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {estudiantesPreviosEncontrados.map(est => {
                    const edadEst = est.fecha_nacimiento ? calcularEdad(est.fecha_nacimiento) : 0;
                    const esGrad = est.salon_actual === 'Graduado' || edadEst > 12;
                    const esSeleccionado = ninoSeleccionadoId === est.id || (nombreEst.toLowerCase().trim() === est.nombre.toLowerCase().trim() && apellidoEst.toLowerCase().trim() === est.apellido.toLowerCase().trim());

                    return (
                      <button
                        key={est.id}
                        type="button"
                        onClick={() => handleSeleccionarNinoPrevio(est)}
                        style={{
                          background: esSeleccionado ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.08)',
                          border: `1px solid ${esSeleccionado ? 'white' : 'var(--glass-border)'}`,
                          color: 'white',
                          padding: '0.45rem 0.75rem',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: esSeleccionado ? 'bold' : 'normal',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          boxShadow: esSeleccionado ? '0 0 10px rgba(59, 130, 246, 0.4)' : 'none',
                          transition: 'all 0.2s'
                        }}
                      >
                        {est.genero === 'Niña' ? '👧' : '👦'} {est.nombre} {est.apellido}
                        {edadEst > 0 ? ` (${edadEst} años)` : ''}
                        {esGrad ? ' 🎓' : ''}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => {
                      setNinoSeleccionadoId(null);
                      setNombreEst('');
                      setApellidoEst('');
                      setGeneroEst('');
                      setFechaNacimientoEst('');
                      setModoSalida('Lo vienen a buscar');
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px dashed var(--glass-border)',
                      color: 'var(--text-secondary)',
                      padding: '0.45rem 0.75rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    + Registrar otro niño
                  </button>
                </div>
              </div>
            )}

            <div className="form-responsive-row">
              <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                <label style={{ fontSize: '0.85rem' }}>Nombre del Niño/a <span style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  type="text" 
                  required 
                  value={nombreEst} 
                  onChange={e => setNombreEst(e.target.value)} 
                  placeholder="Ej. Mateo" 
                  style={{ padding: '0.65rem 0.8rem', fontSize: '0.95rem' }}
                />
                {!nombreEst.trim() && (
                  <span style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.25rem', display: 'block', fontWeight: 'bold' }}>
                    ⚠️ Falta completar este campo
                  </span>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                <label style={{ fontSize: '0.85rem' }}>Apellido del Niño/a <span style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  type="text" 
                  required 
                  value={apellidoEst} 
                  onChange={e => setApellidoEst(e.target.value)} 
                  placeholder="Ej. Pérez" 
                  style={{ padding: '0.65rem 0.8rem', fontSize: '0.95rem' }}
                />
                {!apellidoEst.trim() && (
                  <span style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.25rem', display: 'block', fontWeight: 'bold' }}>
                    ⚠️ Falta completar este campo
                  </span>
                )}
              </div>
            </div>

            <div className="form-responsive-row" style={{ alignItems: 'flex-start' }}>
              <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                <label style={{ fontSize: '0.85rem' }}>Género <span style={{ color: '#ef4444' }}>*</span></label>
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.4rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input 
                      type="radio" 
                      name="generoEst" 
                      value="Niño" 
                      checked={generoEst === 'Niño'} 
                      onChange={e => setGeneroEst(e.target.value)} 
                      required 
                    /> Niño
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input 
                      type="radio" 
                      name="generoEst" 
                      value="Niña" 
                      checked={generoEst === 'Niña'} 
                      onChange={e => setGeneroEst(e.target.value)} 
                      required 
                    /> Niña
                  </label>
                </div>
                {!generoEst && (
                  <span style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.25rem', display: 'block', fontWeight: 'bold' }}>
                    ⚠️ Falta completar este campo
                  </span>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <CampoFechaNacimiento 
                  value={fechaNacimientoEst} 
                  onChange={setFechaNacimientoEst} 
                  minYear={2010} 
                  required={true} 
                />
                {!fechaNacimientoEst && (
                  <span style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.25rem', display: 'block', fontWeight: 'bold' }}>
                    ⚠️ Falta completar este campo
                  </span>
                )}
              </div>
            </div>

            {fechaNacimientoEst && (
              <div style={{ marginTop: '0.8rem', padding: '0.6rem', background: (edad < 8 || edad > 12) ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', fontSize: '0.85rem' }}>
                <p style={{ margin: 0 }}><strong>Edad calculada:</strong> {edad} años</p>
                <p style={{ margin: '0.2rem 0 0 0' }}>
                  <strong>Salón asignado:</strong> {edad > 12 ? '❌ Excede límite (Mayor a 12 años)' : (edad >= 8 ? 'Usos Múltiples' : 'Menor de 8 años')}
                </p>
                {edad > 12 && (
                  <p style={{ color: '#ef4444', marginTop: '0.3rem', margin: '0.3rem 0 0 0', fontWeight: 'bold' }}>
                    ⚠️ El límite de edad permitido es de máximo 12 años.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* SECCIÓN 3: MODO DE SALIDA / RETIRO */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: '12px', marginBottom: '1.2rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--accent-primary)', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <LogOut size={18} /> Modo de Salida / Retiro <span style={{ color: '#ef4444' }}>*</span>
            </h3>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '0.8rem' }}>
              Indique cómo se retirará el niño/a al finalizar la actividad de Maranatha Kids:
            </p>

            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
                fontSize: '0.85rem',
                background: modoSalida === 'Lo vienen a buscar' ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-secondary)',
                border: `1px solid ${modoSalida === 'Lo vienen a buscar' ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                padding: '0.65rem 0.75rem',
                borderRadius: '8px',
                flex: '1 1 130px',
                minWidth: 0
              }}>
                <input 
                  type="radio" 
                  name="modoSalida" 
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
                fontSize: '0.85rem',
                background: modoSalida === 'Se va solo/a' ? 'rgba(234, 179, 8, 0.2)' : 'var(--bg-secondary)',
                border: `1px solid ${modoSalida === 'Se va solo/a' ? '#eab308' : 'var(--glass-border)'}`,
                padding: '0.65rem 0.75rem',
                borderRadius: '8px',
                flex: '1 1 130px',
                minWidth: 0
              }}>
                <input 
                  type="radio" 
                  name="modoSalida" 
                  value="Se va solo/a" 
                  checked={modoSalida === 'Se va solo/a'} 
                  onChange={e => setModoSalida(e.target.value)} 
                  required 
                />
                <span><strong>Se va solo/a</strong></span>
              </label>
            </div>
            {!modoSalida && (
              <span style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.4rem', display: 'block', fontWeight: 'bold' }}>
                ⚠️ Falta completar este campo
              </span>
            )}
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            disabled={
              isSubmitting || 
              (edad <= 12 && isSalonLleno) ||
              !nombreRep.trim() || 
              !apellidoRep.trim() || 
              numeroTelefono.length !== 7 || 
              (parentescoRep === 'Otro' && !otroParentesco.trim()) || 
              !nombreEst.trim() || 
              !apellidoEst.trim() || 
              !generoEst || 
              !fechaNacimientoEst || 
              !modoSalida ||
              edad < 8
            }
            style={{
              width: '100%',
              padding: '0.9rem',
              fontSize: '1rem',
              fontWeight: 'bold',
              background: (edad <= 12 && isSalonLleno) ? '#ef4444' : (edad > 12 ? 'rgba(234, 179, 8, 0.25)' : undefined),
              border: edad > 12 ? '2px solid #eab308' : undefined,
              color: edad > 12 ? '#fef08a' : undefined
            }}
          >
            {isSubmitting ? 'Guardando...' : (edad > 12 ? '🎓 Guardar en Registro de Graduados' : (isSalonLleno ? 'Salón Lleno (Capacidad 300 Alcanzada)' : 'Obtener Número de Turno'))}
          </button>
        </form>
      </div>
    </div>
  );
}
