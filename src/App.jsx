import React, { useState, useEffect } from 'react';
import FormularioIngreso from './components/FormularioIngreso';
import ListaEstudiantes from './components/ListaEstudiantes';
import HistorialDomingos from './components/HistorialDomingos';
import GraduacionAnimation from './components/GraduacionAnimation';
import RegistroRepresentante from './components/RegistroRepresentante';
import ModalCerrarDia from './components/ModalCerrarDia';
import ModalQR from './components/ModalQR';
import ModalGraduados from './components/ModalGraduados';
import { Sparkles, Archive, Users, QrCode, UserCheck, GraduationCap } from 'lucide-react';
import { supabase } from './lib/supabase';

function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [vistaActiva, setVistaActiva] = useState('principal'); // 'principal', 'historial', 'registro-qr'
  const [isCerrando, setIsCerrando] = useState(false);
  const [graduacionData, setGraduacionData] = useState(null);
  const [mostrarModalQR, setMostrarModalQR] = useState(false);
  const [mostrarModalGraduados, setMostrarModalGraduados] = useState(false);
  const [modalCerrarData, setModalCerrarData] = useState(null); // { activos: [...] }
  const [esPublico, setEsPublico] = useState(false);

  // Detectar si se ingresó directamente por escaneo de código QR (URL con ?registro=true o #registro)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hasRegistroParam = searchParams.get('registro') === 'true' || window.location.hash === '#registro';
    if (hasRegistroParam) {
      setVistaActiva('registro-qr');
      setEsPublico(true);
    }
  }, []);

  const handleEstudianteAgregado = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleGraduacion = (data) => {
    setGraduacionData(data);
  };

  const handleAbrirCerrarDomingo = async () => {
    setIsCerrando(true);
    try {
      // 1. Obtener todos los estudiantes que están activos este domingo
      const { data: activos, error: errFetch } = await supabase
        .from('vista_estudiantes')
        .select('*')
        .eq('activo_este_domingo', true);

      if (errFetch) throw errFetch;

      if (!activos || activos.length === 0) {
        alert('No hay estudiantes en la lista actual para guardar.');
        setIsCerrando(false);
        return;
      }

      setModalCerrarData({ activos });
    } catch (error) {
      console.error(error);
      alert('Error al consultar lista de estudiantes: ' + error.message);
    }
    setIsCerrando(false);
  };

  const handleConfirmarCierreDia = async (fechaCierre) => {
    if (!modalCerrarData || !modalCerrarData.activos) return;

    setIsCerrando(true);
    try {
      const activos = modalCerrarData.activos;

      // 2. Guardar o actualizar en historial_domingos con la fecha seleccionada por el usuario
      const { data: existentes } = await supabase
        .from('historial_domingos')
        .select('*')
        .eq('fecha', fechaCierre);

      if (existentes && existentes.length > 0) {
        const regExistente = existentes[0];
        const estsExistentes = regExistente.estudiantes || [];
        const estsCombinados = [...estsExistentes];

        activos.forEach(nuevoEst => {
          if (!estsCombinados.some(e => e.id === nuevoEst.id || (e.nombre === nuevoEst.nombre && e.apellido === nuevoEst.apellido))) {
            estsCombinados.push(nuevoEst);
          }
        });

        const { error: errUpdateHist } = await supabase
          .from('historial_domingos')
          .update({ estudiantes: estsCombinados })
          .eq('id', regExistente.id);

        if (errUpdateHist) throw errUpdateHist;
      } else {
        const { error: errInsert } = await supabase
          .from('historial_domingos')
          .insert([{ fecha: fechaCierre, estudiantes: activos }]);

        if (errInsert) throw errInsert;
      }

      // 3. Desactivar a todos los estudiantes (activo_este_domingo = false)
      const { error: errUpdate } = await supabase
        .from('estudiantes')
        .update({ activo_este_domingo: false })
        .eq('activo_este_domingo', true);
      
      if (errUpdate) throw errUpdate;

      alert(`¡Día cerrado correctamente para la fecha ${fechaCierre}! Los datos se han guardado en el historial.`);
      setModalCerrarData(null);
      setRefreshTrigger(prev => prev + 1);

    } catch (error) {
      console.error(error);
      alert('Hubo un error al cerrar el día: ' + error.message);
    }
    setIsCerrando(false);
  };

  // Si la vista es la del representante (por QR o navegación directa)
  if (vistaActiva === 'registro-qr') {
    return (
      <div className="container">
        <RegistroRepresentante esPublico={esPublico} onVolverAlPanel={esPublico ? null : () => setVistaActiva('principal')} />
      </div>
    );
  }

  return (
    <div className="container">
      <header>
        <h1 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          Maranatha Kids
        </h1>
        <p>Sistema de Gestión y Transición de Salones</p>

        {/* Botón destacado para mostrar QR a los representantes */}
        <div style={{ marginTop: '1.2rem', textAlign: 'center' }}>
          <button
            onClick={() => setMostrarModalQR(true)}
            style={{
              background: 'rgba(59, 130, 246, 0.2)',
              border: '2px solid var(--accent-primary)',
              color: 'white',
              padding: '0.6rem 1.2rem',
              borderRadius: '30px',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
            }}
          >
            <QrCode size={20} color="var(--accent-primary)" />
            Ver Código QR para Representantes
          </button>
        </div>

        {/* Navegación Principal */}
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.8rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setVistaActiva('principal')}
            className={vistaActiva === 'principal' ? 'btn-primary' : 'btn-secondary'}
            style={vistaActiva !== 'principal' ? { background: 'var(--glass-bg)', color: 'white', border: '1px solid var(--glass-border)', padding: '0.75rem 1.2rem', borderRadius: '8px', cursor: 'pointer' } : { padding: '0.75rem 1.2rem' }}
          >
            <Users size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }}/> 
            Panel Actual
          </button>

          <button 
            onClick={() => setVistaActiva('registro-qr')}
            className={vistaActiva === 'registro-qr' ? 'btn-primary' : 'btn-secondary'}
            style={vistaActiva !== 'registro-qr' ? { background: 'var(--glass-bg)', color: 'white', border: '1px solid var(--glass-border)', padding: '0.75rem 1.2rem', borderRadius: '8px', cursor: 'pointer' } : { padding: '0.75rem 1.2rem' }}
          >
            <UserCheck size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }}/> 
            Formulario Representante
          </button>

          <button 
            onClick={() => setVistaActiva('historial')}
            className={vistaActiva === 'historial' ? 'btn-primary' : 'btn-secondary'}
            style={vistaActiva !== 'historial' ? { background: 'var(--glass-bg)', color: 'white', border: '1px solid var(--glass-border)', padding: '0.75rem 1.2rem', borderRadius: '8px', cursor: 'pointer' } : { padding: '0.75rem 1.2rem' }}
          >
            <Archive size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }}/> 
            Ver Historial
          </button>

          <button 
            onClick={() => setMostrarModalGraduados(true)}
            style={{ background: 'rgba(234, 179, 8, 0.12)', color: '#fef08a', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '0.75rem 1.2rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Ver registro discreto de estudiantes graduados"
          >
            <GraduationCap size={18} color="#eab308" /> 
            Graduados
          </button>
        </div>
      </header>

      {vistaActiva === 'principal' ? (
        <main style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <section>
            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Panel de Salones (Hoy)</h2>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => handleEstudianteAgregado()} 
                  style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Actualizar
                </button>
                <button 
                  onClick={handleAbrirCerrarDomingo} 
                  disabled={isCerrando}
                  style={{ background: 'var(--accent-gradient)', border: 'none', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', cursor: isCerrando ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                >
                  {isCerrando ? 'Cargando...' : 'Cerrar Día'}
                </button>
              </div>
            </div>
            <ListaEstudiantes refreshTrigger={refreshTrigger} />
          </section>
        </main>
      ) : (
        <main style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <HistorialDomingos />
        </main>
      )}

      {/* Modal Cerrar Día con Selección/Edición de Fecha */}
      {modalCerrarData && (
        <ModalCerrarDia 
          totalEstudiantes={modalCerrarData.activos.length}
          onClose={() => setModalCerrarData(null)}
          onConfirmar={handleConfirmarCierreDia}
          isCerrando={isCerrando}
        />
      )}

      {/* Modal QR Code */}
      {mostrarModalQR && (
        <ModalQR onClose={() => setMostrarModalQR(false)} />
      )}

      {/* Modal Discreto de Estudiantes Graduados */}
      {mostrarModalGraduados && (
        <ModalGraduados 
          onClose={() => setMostrarModalGraduados(false)} 
          onEstudianteEditado={handleEstudianteAgregado}
        />
      )}

      {/* Animación de Graduación */}
      {graduacionData && (
        <GraduacionAnimation
          nombre={graduacionData.nombre}
          salonNuevo={graduacionData.salonNuevo}
          onClose={() => setGraduacionData(null)}
        />
      )}
    </div>
  );
}

export default App;
