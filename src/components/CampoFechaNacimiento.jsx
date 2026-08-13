import React, { useState, useRef, useEffect } from 'react';

const MESES = [
  { val: '01', nombre: '01 - Enero' },
  { val: '02', nombre: '02 - Febrero' },
  { val: '03', nombre: '03 - Marzo' },
  { val: '04', nombre: '04 - Abril' },
  { val: '05', nombre: '05 - Mayo' },
  { val: '06', nombre: '06 - Junio' },
  { val: '07', nombre: '07 - Julio' },
  { val: '08', nombre: '08 - Agosto' },
  { val: '09', nombre: '09 - Septiembre' },
  { val: '10', nombre: '10 - Octubre' },
  { val: '11', nombre: '11 - Noviembre' },
  { val: '12', nombre: '12 - Diciembre' }
];

export default function CampoFechaNacimiento({ value, onChange, minYear = 2010, required = true }) {
  // Modos disponibles: 'teclado' (escribir DD/MM/AAAA) o 'desplegables' (seleccionar de lista)
  const [modo, setModo] = useState('teclado');

  const diaRef = useRef(null);
  const mesRef = useRef(null);
  const anioRef = useRef(null);

  const hoyObj = new Date();
  const hoyAnio = hoyObj.getFullYear();

  // Desglosar valor YYYY-MM-DD
  const partes = (value || '').split('-');
  const [anioStr, setAnioStr] = useState(partes[0] || '');
  const [mesStr, setMesStr] = useState(partes[1] || '');
  const [diaStr, setDiaStr] = useState(partes[2] || '');

  // Sincronizar estado local si `value` cambia externamente
  useEffect(() => {
    const p = (value || '').split('-');
    setAnioStr(p[0] || '');
    setMesStr(p[1] || '');
    setDiaStr(p[2] || '');
  }, [value]);

  // Lista de años desde minYear (2010) hasta hoyAnio
  const aniosDisponibles = [];
  for (let y = hoyAnio; y >= minYear; y--) {
    aniosDisponibles.push(String(y));
  }

  // Lista de días 1..31
  const diasDisponibles = [];
  for (let d = 1; d <= 31; d++) {
    diasDisponibles.push(String(d).padStart(2, '0'));
  }

  const actualizarFechaGlobal = (d, m, a) => {
    if (d && m && a && a.length === 4) {
      const dPadded = String(d).padStart(2, '0');
      const mPadded = String(m).padStart(2, '0');
      onChange(`${a}-${mPadded}-${dPadded}`);
    } else {
      onChange('');
    }
  };

  const handleDiaChange = (e) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 2);
    if (parseInt(val, 10) > 31) val = '31';
    setDiaStr(val);
    actualizarFechaGlobal(val, mesStr, anioStr);

    if (val.length === 2 && mesRef.current) {
      mesRef.current.focus();
    }
  };

  const handleMesChange = (e) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 2);
    if (parseInt(val, 10) > 12) val = '12';
    setMesStr(val);
    actualizarFechaGlobal(diaStr, val, anioStr);

    if (val.length === 2 && anioRef.current) {
      anioRef.current.focus();
    }
  };

  const handleAnioChange = (e) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setAnioStr(val);
    actualizarFechaGlobal(diaStr, mesStr, val);
  };

  const handleSelectChange = (nDia, nMes, nAnio) => {
    setDiaStr(nDia);
    setMesStr(nMes);
    setAnioStr(nAnio);
    if (nDia && nMes && nAnio) {
      onChange(`${nAnio}-${nMes}-${nDia}`);
    } else {
      onChange('');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
        <label style={{ fontSize: '0.85rem', margin: 0, color: 'var(--text-secondary)', fontWeight: 500 }}>
          Fecha de Nacimiento
        </label>
        
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          <button
            type="button"
            onClick={() => setModo('teclado')}
            style={{
              background: modo === 'teclado' ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
              border: modo === 'teclado' ? '1px solid var(--accent-primary)' : '1px solid transparent',
              color: modo === 'teclado' ? 'white' : 'var(--text-secondary)',
              fontSize: '0.78rem',
              cursor: 'pointer',
              padding: '3px 8px',
              borderRadius: '4px',
              fontWeight: modo === 'teclado' ? 'bold' : 'normal'
            }}
            title="Escribir números directamente"
          >
            Teclado
          </button>

          <button
            type="button"
            onClick={() => setModo('desplegables')}
            style={{
              background: modo === 'desplegables' ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
              border: modo === 'desplegables' ? '1px solid var(--accent-primary)' : '1px solid transparent',
              color: modo === 'desplegables' ? 'white' : 'var(--text-secondary)',
              fontSize: '0.78rem',
              cursor: 'pointer',
              padding: '3px 8px',
              borderRadius: '4px',
              fontWeight: modo === 'desplegables' ? 'bold' : 'normal'
            }}
            title="Seleccionar de lista desplegable"
          >
            Lista
          </button>
        </div>
      </div>

      {modo === 'teclado' && (
        <div style={{ display: 'flex', gap: '0.4rem', width: '100%', alignItems: 'center' }}>
          {/* Entrada de Día */}
          <div style={{ flex: 1 }}>
            <input
              ref={diaRef}
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Día (DD)"
              value={diaStr}
              onChange={handleDiaChange}
              required={required}
              style={{
                width: '100%',
                padding: '0.65rem 0.5rem',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '0.95rem',
                textAlign: 'center',
                fontWeight: 'bold'
              }}
            />
          </div>

          <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>/</span>

          {/* Entrada de Mes */}
          <div style={{ flex: 1.2 }}>
            <input
              ref={mesRef}
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Mes (MM)"
              value={mesStr}
              onChange={handleMesChange}
              required={required}
              style={{
                width: '100%',
                padding: '0.65rem 0.5rem',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '0.95rem',
                textAlign: 'center',
                fontWeight: 'bold'
              }}
            />
          </div>

          <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>/</span>

          {/* Entrada de Año */}
          <div style={{ flex: 1.5 }}>
            <input
              ref={anioRef}
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Año (AAAA)"
              value={anioStr}
              onChange={handleAnioChange}
              required={required}
              style={{
                width: '100%',
                padding: '0.65rem 0.5rem',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '0.95rem',
                textAlign: 'center',
                fontWeight: 'bold'
              }}
            />
          </div>
        </div>
      )}

      {modo === 'desplegables' && (
        <div style={{ display: 'flex', gap: '0.4rem', width: '100%' }}>
          {/* Selector de Día */}
          <select
            value={diaStr}
            onChange={(e) => handleSelectChange(e.target.value, mesStr, anioStr)}
            style={{ flex: '1', padding: '0.65rem 0.3rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'white', fontSize: '0.9rem' }}
            required={required}
          >
            <option value="">Día</option>
            {diasDisponibles.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Selector de Mes */}
          <select
            value={mesStr}
            onChange={(e) => handleSelectChange(diaStr, e.target.value, anioStr)}
            style={{ flex: '1.4', padding: '0.65rem 0.3rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'white', fontSize: '0.9rem' }}
            required={required}
          >
            <option value="">Mes</option>
            {MESES.map(m => (
              <option key={m.val} value={m.val}>{m.nombre}</option>
            ))}
          </select>

          {/* Selector de Año */}
          <select
            value={anioStr}
            onChange={(e) => handleSelectChange(diaStr, mesStr, e.target.value)}
            style={{ flex: '1.2', padding: '0.65rem 0.3rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'white', fontSize: '0.9rem' }}
            required={required}
          >
            <option value="">Año</option>
            {aniosDisponibles.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
