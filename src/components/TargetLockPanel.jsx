import React from 'react';
import { Crosshair, ShieldAlert, Activity, Globe, Compass } from 'lucide-react';

const GODS_EYE_GREEN = '#00ff88';
const THREAT_RED = '#ff4444';
const JAMMING_PURPLE = '#ff00ff';

export default function TargetLockPanel({ activeTarget, onClose }) {
  if (!activeTarget) return null;

  const isCritical = activeTarget.threatLevel === 'CRITICAL';
  const isHigh = activeTarget.threatLevel === 'HIGH' || activeTarget.type === 'hotspot';
  const themeColor = isCritical ? JAMMING_PURPLE : (isHigh ? THREAT_RED : GODS_EYE_GREEN);

  return (
    <div className="overlay-panel target-lock-panel" style={{ 
      width: '280px', 
      borderLeft: `3px solid ${themeColor}`,
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 10001
    }}>
      <div className="panel-header" style={{ color: themeColor, padding: '8px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Crosshair className="rotating-icon" size={14} />
          <span style={{ fontSize: '10px', letterSpacing: '1.5px', fontWeight: 'bold' }}>LOCK_ACQUIRED</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '14px' }}>×</button>
      </div>
      
      <div className="target-details" style={{ padding: '12px', fontFamily: 'JetBrains Mono', fontSize: '10px', color: '#fff' }}>
        <div style={{ marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
          <div style={{ color: '#888', fontSize: '8px' }}>TARGET_ID</div>
          <div style={{ fontSize: '12px', color: themeColor, fontWeight: 'bold' }}>{activeTarget.id}</div>
          <div style={{ fontSize: '8px', color: '#555', marginTop: '2px' }}>CLASSIFICATION: {activeTarget.type.toUpperCase()}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div className="detail-row">
            <span className="detail-label"><Globe size={10} /> POS:</span>
            <span>{activeTarget.lat.toFixed(3)}, {activeTarget.lng.toFixed(3)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label"><Activity size={10} /> VEL:</span>
            <span>{Math.floor(activeTarget.vel)} KTS</span>
          </div>
          {activeTarget.alt > 0 && (
            <div className="detail-row">
              <span className="detail-label"><ShieldAlert size={10} /> ALT:</span>
              <span>{Math.floor(activeTarget.alt)} M</span>
            </div>
          )}
        </div>

        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
          <span style={{ color: '#888', fontSize: '8px' }}>ASSESSMENT:</span>
          <span style={{ 
            color: '#000', 
            background: themeColor, 
            padding: '1px 6px', 
            fontWeight: 'bold', 
            fontSize: '9px',
            boxShadow: `0 0 10px ${themeColor}44`
          }}>
            {activeTarget.threatLevel || 'NOMINAL'}
          </span>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes rotate-icon {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .rotating-icon { animation: rotate-icon 4s linear infinite; }
        .detail-row { display: flex; justify-content: space-between; align-items: center; }
        .detail-label { color: #888; display: flex; alignItems: center; gap: 4px; }
      `}} />
    </div>
  );
}
