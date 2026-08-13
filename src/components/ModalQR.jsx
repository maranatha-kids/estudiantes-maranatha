import React, { useState } from 'react';
import { X, Copy, ExternalLink, QrCode, Check } from 'lucide-react';

export default function ModalQR({ onClose }) {
  const [copiado, setCopiado] = useState(false);

  // URL del formulario de registro público
  const origin = window.location.origin;
  const pathname = window.location.pathname.endsWith('/') ? window.location.pathname : window.location.pathname + '/';
  const qrUrl = `${origin}${pathname}?registro=true`;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrUrl)}&margin=10`;

  const handleCopiarLink = () => {
    navigator.clipboard.writeText(qrUrl);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const handleAbrirLink = () => {
    window.open(qrUrl, '_blank');
  };

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
        maxWidth: '450px',
        width: '100%',
        textAlign: 'center',
        position: 'relative',
        border: '2px solid var(--accent-primary)',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
      }}>
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '12px', right: '12px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '4px'
          }}
        >
          <X size={24} />
        </button>

        <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(59, 130, 246, 0.15)', borderRadius: '50%', marginBottom: '1rem' }}>
          <QrCode size={36} color="var(--accent-primary)" />
        </div>

        <h2 style={{ fontSize: '1.5rem', margin: 0 }}>QR para Representantes</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.4rem', marginBottom: '1.5rem' }}>
          Escanea este código con la cámara de tu teléfono para registrar tus datos y los del niño/a.
        </p>

        {/* QR Code Container */}
        <div style={{
          background: 'white',
          padding: '1rem',
          borderRadius: '16px',
          display: 'inline-flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: '1.5rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
        }}>
          <img 
            src={qrImageUrl} 
            alt="Código QR para Registro" 
            width={220} 
            height={220} 
            style={{ display: 'block', borderRadius: '8px' }}
          />
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 'bold', marginBottom: '1.2rem' }}>
          Al completar el registro, el sistema generará un número de ticket.
        </p>

        {/* Botones de acción */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button 
            onClick={handleCopiarLink}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              background: 'var(--accent-gradient)', border: 'none',
              color: 'white', padding: '0.8rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 'bold'
            }}
          >
            {copiado ? <Check size={18} color="#10b981" /> : <Copy size={18} />}
            {copiado ? '¡Enlace Copiado al Portapapeles!' : 'Copiar Enlace Directo'}
          </button>
        </div>
      </div>
    </div>
  );
}
