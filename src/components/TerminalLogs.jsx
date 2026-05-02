import React, { useState, useEffect } from 'react';
import { Terminal, Minus, Square } from 'lucide-react';

const GODS_EYE_GREEN = '#00ff88';

const TerminalLogs = React.memo(() => {
  const [logs, setLogs] = useState([]);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const actions = ["DECRYPTING", "INTERCEPT", "REROUTING", "BYPASSING", "UPLINK", "TRACE", "SEISMIC SCAN"];
      const targets = ["SAT-COM", "MIL-NET", "ADS-B", "AIS-STREAM", "TCP-R", "NODE-7", "USGS-NODE"];
      const hex = Math.floor(Math.random()*16777215).toString(16).toUpperCase().padStart(6, '0');
      
      setLogs(prev => {
        const newLogs = [...prev, `[${new Date().toISOString().split('T')[1].slice(0,-1)}] ${actions[Math.floor(Math.random()*actions.length)]} ${targets[Math.floor(Math.random()*targets.length)]} :: 0x${hex}`];
        return newLogs.slice(-12); 
      });
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`terminal-panel ${isCollapsed ? 'collapsed' : ''}`} style={{ 
      position: 'absolute', bottom: '15px', right: '15px', zIndex: 1001,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      height: isCollapsed ? '35px' : '200px'
    }}>
      <div 
        style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: isCollapsed ? 'none' : '1px solid rgba(0, 255, 136, 0.2)', paddingBottom: '5px', marginBottom: '5px', color: GODS_EYE_GREEN, cursor: 'pointer' }}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <Terminal size={14} />
        <span style={{ fontSize: '10px', fontWeight: 'bold' }}>RAW INTERCEPT LOG</span>
        <div style={{ marginLeft: 'auto', opacity: 0.6 }}>
          {isCollapsed ? <Square size={10} /> : <Minus size={10} />}
        </div>
      </div>
      {!isCollapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
          {logs.map((log, i) => (
            <div key={i} className="terminal-line">{log}</div>
          ))}
        </div>
      )}
    </div>
  );
});

export default TerminalLogs;
