import React, { useMemo, useState } from 'react';
import { Activity, Radar, Cpu, Newspaper, Minus, Square, Terminal } from 'lucide-react';

const PanelWrapper = ({ title, icon: Icon, color, children, defaultCollapsed = false }) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <div className={`overlay-panel ${isCollapsed ? 'collapsed' : ''}`} style={{ 
      transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      maxHeight: isCollapsed ? '48px' : '90vh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div className="panel-header" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => setIsCollapsed(!isCollapsed)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icon size={18} color={color} className={!isCollapsed ? 'pulse-icon' : ''} />
          <span style={{ fontSize: '13px', letterSpacing: '2.5px', color: '#fff', fontWeight: 'bold' }}>{title}</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, boxShadow: `0 0 10px ${color}` }}></div>
          {isCollapsed ? <Square size={14} color="#888" /> : <Minus size={14} color="#888" />}
        </div>
      </div>
      {!isCollapsed && (
        <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {children}
        </div>
      )}
    </div>
  );
};

export const LeftPanel = ({ loading, counts, points }) => {
  const telemetryFeed = useMemo(() => {
    return points
      .filter(p => p.type === 'flight' || p.type === 'boat')
      .slice(0, 12);
  }, [points]);

  const milCount = points.filter(p => p.isMil).length;
  const criticalCount = points.filter(p => p.threatLevel === 'CRITICAL').length;

  return (
    <div className="panel-left" style={{ position: 'absolute', top: '15px', left: '15px', display: 'flex', flexDirection: 'column', gap: '15px', zIndex: 1000, width: '320px' }}>
      <PanelWrapper title="GOD'S EYE" icon={Radar} color="#00ff88">
        <div className="stat-grid">
          <div className="stat-box">
            <div className="stat-value aircraft">{counts.flights}</div>
            <div className="stat-label">Air Total</div>
          </div>
          <div className="stat-box">
            <div className="stat-value" style={{ color: '#ff4444' }}>{milCount}</div>
            <div className="stat-label">Mil Int</div>
          </div>
          <div className="stat-box">
            <div className="stat-value" style={{ color: '#ff00ff' }}>{criticalCount}</div>
            <div className="stat-label">Critical</div>
          </div>
          <div className="stat-box">
            <div className="stat-value ships">{counts.boats}</div>
            <div className="stat-label">Vessels</div>
          </div>
          <div className="stat-box">
            <div className="stat-value satellites">{counts.satellites}</div>
            <div className="stat-label">Orbital</div>
          </div>
          <div className="stat-box">
            <div className="stat-value quakes">{counts.earthquakes}</div>
            <div className="stat-label">Seismic</div>
          </div>
        </div>

        <div style={{ background: 'rgba(0,255,136,0.05)', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,255,136,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={14} color="#00ff88" className="heartbeat" />
            <span style={{ fontSize: '10px', letterSpacing: '1.5px', color: '#00ff88' }}>LIVE TELEMETRY</span>
          </div>
          <span style={{ fontSize: '9px', color: '#888' }}>UPLINK: ACTIVE</span>
        </div>
        
        <div className="feed-container" style={{ maxHeight: '350px' }}>
          {telemetryFeed.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontSize: '11px' }}>SCANNING SECTOR...</div>
          ) : telemetryFeed.map((f, i) => (
            <div key={i} className="feed-item" style={{ borderLeft: `2px solid ${f.isMil ? '#ff4444' : (f.type === 'boat' ? '#4488ff' : '#00ff88')}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '11px' }}>
                  {f.callsign || f.id.slice(0, 8)}
                </strong>
                <span style={{ fontSize: '9px', color: f.threatLevel === 'HIGH' ? '#ff4444' : '#888' }}>
                  {f.threatLevel === 'HIGH' ? 'TACTICAL' : 'NOMINAL'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', opacity: 0.6, fontSize: '9px' }}>
                <span>{f.lat.toFixed(2)}N {f.lng.toFixed(2)}E</span>
                <span>{Math.floor(f.vel)} KTS</span>
              </div>
            </div>
          ))}
        </div>
      </PanelWrapper>
    </div>
  );
};

export const RightPanel = ({ news }) => (
  <div className="panel-right" style={{ position: 'absolute', top: '15px', right: '15px', zIndex: 1000, width: '360px' }}>
    <PanelWrapper title="INTEL FEED" icon={Newspaper} color="#ff4444">
      <div className="feed-container" style={{ maxHeight: '600px' }}>
        {news.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', fontFamily: 'JetBrains Mono' }}>
            <Terminal size={24} style={{ marginBottom: '10px', opacity: 0.3 }} />
            <div style={{ fontSize: '11px', color: '#ff4444', letterSpacing: '1px' }}>NO ACTIVE SIGINT</div>
            <div style={{ fontSize: '9px', color: '#888', marginTop: '5px' }}>LISTENING ON PUBLIC FREQUENCIES...</div>
          </div>
        ) : news.map((n, i) => (
          <div key={i} className="feed-item" style={{ borderLeft: '2px solid #ff4444', paddingLeft: '12px', background: 'rgba(255,68,68,0.02)', marginBottom: '4px' }}>
            <div style={{ fontSize: '8px', color: '#ff4444', marginBottom: '4px', letterSpacing: '1px' }}>[ALERT_0${i+1}]</div>
            <strong style={{ fontSize: '12px', color: '#fff', lineHeight: '1.4' }}>{n.title}</strong>
            <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '9px', color: '#888' }}>SOURCE: {n.source?.name || 'INTEL_NODE'}</span>
              <span style={{ fontSize: '8px', color: '#ff4444', border: '1px solid #ff4444', padding: '1px 4px' }}>UNCLASSIFIED</span>
            </div>
          </div>
        ))}
      </div>
    </PanelWrapper>
    
    <style dangerouslySetInnerHTML={{ __html: `
      @keyframes pulse-glow {
        0% { opacity: 0.6; }
        50% { opacity: 1; }
        100% { opacity: 0.6; }
      }
      .pulse-icon { animation: pulse-glow 2s infinite; }
      .heartbeat { animation: pulse-glow 1s infinite; }
    `}} />
  </div>
);
