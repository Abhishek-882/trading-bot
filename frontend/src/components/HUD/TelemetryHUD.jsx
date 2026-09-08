import React, { useState, useEffect } from 'react';
import { motionEngine } from '../../engine/motionPipeline';
import { sound } from '../../engine/soundFX';

export function TelemetryHUD() {
  const [telemetry, setTelemetry] = useState({
    pitch: 0,
    yaw: 0,
    roll: 0,
    x: 0,
    y: 0,
    fps: 60,
  });
  const [isMuted, setIsMuted] = useState(sound.isMuted);
  const [isEco, setIsEco] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    let frameCount = 0;
    let lastFpsTime = performance.now();
    let currentFps = 60;

    const unsubscribe = motionEngine.subscribe(({ pointer }) => {
      frameCount++;
      const now = performance.now();
      if (now - lastFpsTime >= 1000) {
        currentFps = Math.round((frameCount * 1000) / (now - lastFpsTime));
        frameCount = 0;
        lastFpsTime = now;
      }

      setTelemetry({
        pitch: pointer.pitch,
        yaw: pointer.yaw,
        roll: pointer.roll,
        x: pointer.x,
        y: pointer.y,
        fps: Math.min(144, currentFps),
      });
    });

    return () => unsubscribe();
  }, []);

  const handleToggleSound = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const handleToggleEco = () => {
    const nextEco = !isEco;
    setIsEco(nextEco);
    motionEngine.setEcoMode(nextEco);
    sound.playClick();
  };

  return (
    <div className="fixed top-3 right-4 z-40 select-none font-mono text-[10px] hidden md:block">
      <div className="bg-[#101217e6] backdrop-blur-md border border-[#252a36] rounded-xl p-2.5 shadow-2xl transition-all duration-300 w-56">
        {/* HUD Top Bar */}
        <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#252a36]">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-gmgn-accent animate-pulse" />
            <span className="text-gray-300 font-bold uppercase tracking-wider text-[9px]">Telemetry HUD</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Toggle */}
            <button
              onClick={handleToggleSound}
              title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
              className="text-gray-400 hover:text-white transition-colors"
            >
              {isMuted ? '🔇' : '🔊'}
            </button>

            {/* Eco Mode Toggle */}
            <button
              onClick={handleToggleEco}
              title="Toggle Low Power / Eco Mode"
              className={`px-1 rounded text-[8px] font-bold ${
                isEco ? 'bg-gmgn-yellow text-black' : 'bg-[#1e222d] text-gray-400 hover:text-white'
              }`}
            >
              ECO
            </button>

            {/* Minimize */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-gray-500 hover:text-white text-xs"
            >
              {isCollapsed ? '+' : '−'}
            </button>
          </div>
        </div>

        {/* Collapsible Content */}
        {!isCollapsed && (
          <div className="space-y-2">
            {/* Gimbal Compass & Gyroscope */}
            <div className="flex items-center justify-between gap-2 bg-[#0c0e12] p-1.5 rounded-lg border border-[#1d212b]">
              <div className="flex items-center gap-2">
                {/* Dynamic SVG Compass Reticle */}
                <div
                  className="w-7 h-7 relative rounded-full border border-gmgn-accent/40 flex items-center justify-center transition-transform duration-75"
                  style={{
                    transform: `rotate(${telemetry.yaw.toFixed(1)}deg)`,
                  }}
                >
                  <div className="w-1 h-3 bg-gmgn-accent/80 rounded-full" />
                  <div className="absolute top-0.5 text-[6px] text-gmgn-accent font-bold">N</div>
                </div>

                <div>
                  <div className="text-gray-400 text-[9px]">GIMBAL ATTITUDE</div>
                  <div className="text-white font-bold text-[10px]">
                    P: {telemetry.pitch > 0 ? '+' : ''}{telemetry.pitch.toFixed(0)}° &nbsp;
                    Y: {telemetry.yaw > 0 ? '+' : ''}{telemetry.yaw.toFixed(0)}°
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[9px] text-gmgn-accent font-bold">{telemetry.fps} FPS</div>
                <div className="text-[8px] text-gray-500">2,480 TPS</div>
              </div>
            </div>

            {/* Spatial Vector Coordinates */}
            <div className="grid grid-cols-2 gap-1 text-[9px] text-gray-400">
              <div className="bg-[#0c0e12] px-1.5 py-1 rounded border border-[#1d212b] flex justify-between">
                <span>COORD X:</span>
                <span className="text-gray-200 font-mono">
                  {telemetry.x >= 0 ? '+' : ''}{telemetry.x.toFixed(2)}
                </span>
              </div>
              <div className="bg-[#0c0e12] px-1.5 py-1 rounded border border-[#1d212b] flex justify-between">
                <span>COORD Y:</span>
                <span className="text-gray-200 font-mono">
                  {telemetry.y >= 0 ? '+' : ''}{telemetry.y.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Protocol Status Bar */}
            <div className="flex items-center justify-between text-[8px] text-gray-500 pt-0.5 border-t border-[#1d212b]">
              <span>SOLANA MAINNET</span>
              <span className="text-gmgn-green">SYNCED (30s)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
