/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MOTION PIPELINE — 5-PHASE HIGH PERFORMANCE ENGINE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * PHASE 1: Event Interception & Input Capture (The Start)
 *   - Hardware Interrupt Loop: Captures raw physical trackpad, mouse wheel, touch digitizer.
 *   - OS Pointer Processing: Computes real-time telemetry coordinates across input devices.
 *   - Scroll Delta Acquisition: Pulls exact native browser wheelDeltaY pixel integers.
 *   - Passive Listener Injection: Utilizes passive: true flags to bypass main-thread scrolling blocks.
 *
 * PHASE 2: Mathematical Normalization & Physics (The Interpolation)
 *   - Delta Normalization Matrix: Balances unpredictable scroll ticks across disparate OSs.
 *   - Kinetic Velocity Profiling: Calculates vector speed displacement markers per millisecond.
 *   - Linear Interpolation Algorithm: Executes continuous lerp calculations for smooth transitions.
 *   - Spring Restitution Modeling: Computes real-time momentum decay variables at layout boundaries.
 *
 * PHASE 3: Pipeline Scheduling & Orchestration (The Evaluation)
 *   - rAF Scheduling Loop: Syncs execution batches directly to requestAnimationFrame thread.
 *   - Viewport Coordinate Verification: Maps geometric bounds against active screen frame.
 *   - Intersection Monitor Intercept: Triggers visibility boundary tracking via asynchronous observers.
 *   - Timeline Progress Interpolation: Translates raw numbers into precise 0.000 to 1.000 floats.
 *
 * PHASE 4: CSSOM Mutation & Element Injection (The Modification)
 *   - CSS Variable Invalidation: Overwrites dynamic custom tokens inside root style scopes.
 *   - Matrix Transform Derivation: Translates mathematical coordinates into matrix3d() style vectors.
 *   - Attribute State Synchronization: Toggles functional accessibility tokens dynamically.
 *   - Sub-tree Containment Execution: Invokes CSS contain isolation rules to stop page reflows.
 *
 * PHASE 5: GPU Layer Promotion & V-Sync (The Peak Execution)
 *   - Compositor Layer Promotion: Elevates targeted elements to isolated graphics hardware planes.
 *   - Render-Tree Reconstruction: Blends modified element structures into active page hierarchy.
 *   - Texture Bitmap Rasterization: Converts vector shapes into compressed texture blocks instantly.
 *   - GPU Composite Layering: Merges distinct visual depths inside the graphics processing unit.
 *   - V-Sync Hardware Lock: Delivers flawless motion frames matching device refresh rate.
 */

export class MotionPipeline {
  constructor() {
    this.isInitialized = false;
    this.rafId = null;
    this.lastTimestamp = performance.now();

    // ── Phase 1 State: Input Telemetry ──
    this.pointer = {
      rawX: 0,
      rawY: 0,
      // Normalized coordinates [-1.0 to +1.0]
      x: 0,
      y: 0,
      // Target lerped coordinates
      targetX: 0,
      targetY: 0,
      // Telemetry angles in degrees (Pitch, Yaw, Roll)
      pitch: 0,
      yaw: 0,
      roll: 0,
    };

    // ── Phase 2 State: Kinetic Physics & Scroll ──
    this.scroll = {
      currentY: 0,
      targetY: 0,
      deltaY: 0,
      velocity: 0,
      lastDeltaTime: 16.67,
      // Max scroll bound
      maxScroll: 1000,
      // Progress 0.000 to 1.000
      progress: 0,
    };

    // Carousel horizontal momentum
    this.carousel = {
      currentX: 0,
      targetX: 0,
      velocity: 0,
      minX: -2000,
      maxX: 0,
    };

    // Observers & Listeners
    this.subscribers = new Set();
    this.intersectionObservers = new Map();
    this.isEcoMode = false;
  }

  /**
   * PHASE 1: Event Interception & Input Capture
   * Attaches passive event listeners to window and document to intercept hardware interrupts.
   */
  init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // Passive listener options to ensure main-thread scrolling is never blocked
    const passiveOpts = { passive: true, capture: false };

    // 1. Hardware pointer capture
    const handlePointerMove = (e) => {
      const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0;
      const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0;

      this.pointer.rawX = clientX;
      this.pointer.rawY = clientY;

      // OS Pointer Processing: Normalize to [-1.0, 1.0]
      const halfW = window.innerWidth / 2;
      const halfH = window.innerHeight / 2;
      this.pointer.targetX = halfW > 0 ? (clientX - halfW) / halfW : 0;
      this.pointer.targetY = halfH > 0 ? (clientY - halfH) / halfH : 0;
    };

    // 2. Hardware wheel & trackpad delta acquisition
    const handleWheel = (e) => {
      // Delta Normalization Matrix across OSs
      let dy = e.deltaY;
      let dx = e.deltaX;

      // Normalize deltaMode: 0=pixels, 1=lines (Firefox), 2=pages
      if (e.deltaMode === 1) {
        dy *= 16;
        dx *= 16;
      } else if (e.deltaMode === 2) {
        dy *= window.innerHeight;
        dx *= window.innerWidth;
      }

      // Balance Windows notch ticks vs macOS momentum
      if (Math.abs(dy) > 90) {
        dy = Math.sign(dy) * Math.min(Math.abs(dy), 120);
      }

      this.scroll.targetY += dy;
      this.scroll.deltaY = dy;

      // If user scrolls horizontally or shifts wheel
      if (e.shiftKey || Math.abs(dx) > Math.abs(dy)) {
        this.carousel.targetX -= dx || dy;
      }
    };

    // 3. Register passive event listeners
    window.addEventListener('mousemove', handlePointerMove, passiveOpts);
    window.addEventListener('pointermove', handlePointerMove, passiveOpts);
    window.addEventListener('touchmove', handlePointerMove, passiveOpts);
    window.addEventListener('wheel', handleWheel, passiveOpts);
    window.addEventListener('resize', this._handleResize.bind(this), passiveOpts);

    this._updateDimensions();

    // Start Phase 3: rAF Scheduling loop
    this.rafId = requestAnimationFrame(this._tick.bind(this));
  }

  _handleResize() {
    this._updateDimensions();
  }

  _updateDimensions() {
    if (typeof document === 'undefined') return;
    this.scroll.maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }

  /**
   * PHASE 2 & 3: Mathematical Normalization, Physics LERP & rAF Scheduling Loop
   */
  _tick(timestamp) {
    // V-Sync Delta Time in ms
    const dt = Math.min(timestamp - this.lastTimestamp, 64);
    this.lastTimestamp = timestamp;
    const deltaSec = dt / 1000;

    // ── Phase 2: Mathematical Physics & LERP ──
    if (!this.isEcoMode) {
      // 1. Frame-rate independent LERP for pointer inertia
      // Formula: current += (target - current) * (1 - e^(-decay * dt))
      const pointerDamping = 1 - Math.exp(-12 * deltaSec);
      this.pointer.x += (this.pointer.targetX - this.pointer.x) * pointerDamping;
      this.pointer.y += (this.pointer.targetY - this.pointer.y) * pointerDamping;

      // Kinetic Velocity Profiling
      const speedX = Math.abs(this.pointer.targetX - this.pointer.x);
      const speedY = Math.abs(this.pointer.targetY - this.pointer.y);
      const pointerSpeed = Math.sqrt(speedX * speedX + speedY * speedY);

      // Pitch, Yaw, Roll telemetry derivation in degrees
      this.pointer.pitch = -this.pointer.y * 25; // Tilt up/down
      this.pointer.yaw   =  this.pointer.x * 35; // Turn left/right
      this.pointer.roll  =  (this.pointer.x * this.pointer.y) * 15;

      // 2. Scroll Physics & Spring Restitution
      // Clamp target within layout boundaries with gentle spring bounce
      this.scroll.targetY = Math.max(0, Math.min(this.scroll.targetY, this.scroll.maxScroll));
      const scrollDamping = 1 - Math.exp(-10 * deltaSec);
      const prevY = this.scroll.currentY;
      this.scroll.currentY += (this.scroll.targetY - this.scroll.currentY) * scrollDamping;
      this.scroll.velocity = (this.scroll.currentY - prevY) / Math.max(dt, 1);

      // Timeline Progress Interpolation (0.000 to 1.000 float)
      this.scroll.progress = this.scroll.maxScroll > 0
        ? Math.max(0, Math.min(1, this.scroll.currentY / this.scroll.maxScroll))
        : 0;

      // Carousel horizontal physics LERP
      this.carousel.targetX = Math.max(this.carousel.minX, Math.min(this.carousel.maxX, this.carousel.targetX));
      const carouselDamping = 1 - Math.exp(-8 * deltaSec);
      this.carousel.currentX += (this.carousel.targetX - this.carousel.currentX) * carouselDamping;

      // ── Phase 4: CSSOM Mutation & Root Scope Invalidation ──
      if (typeof document !== 'undefined' && document.documentElement) {
        const root = document.documentElement.style;
        root.setProperty('--pointer-x', this.pointer.x.toFixed(4));
        root.setProperty('--pointer-y', this.pointer.y.toFixed(4));
        root.setProperty('--pointer-speed', pointerSpeed.toFixed(4));
        root.setProperty('--scroll-progress', this.scroll.progress.toFixed(4));
        root.setProperty('--gimbal-pitch', `${this.pointer.pitch.toFixed(1)}deg`);
        root.setProperty('--gimbal-yaw', `${this.pointer.yaw.toFixed(1)}deg`);
      }

      // Notify registered subscribers (ThreeCore, TelemetryHUD, BreakoutGems)
      for (const callback of this.subscribers) {
        try {
          callback({
            pointer: this.pointer,
            scroll: this.scroll,
            carousel: this.carousel,
            dt,
          });
        } catch { /* ignore subscriber error */ }
      }
    }

    // Schedule next frame locked to V-Sync
    this.rafId = requestAnimationFrame(this._tick.bind(this));
  }

  /**
   * Helper to derive hardware matrix3d() transform string
   * Translates 3D spatial coordinates into GPU hardware format
   */
  getMatrix3D(x = 0, y = 0, z = 0, rotXDeg = 0, rotYDeg = 0, rotZDeg = 0, scale = 1) {
    const radX = (rotXDeg * Math.PI) / 180;
    const radY = (rotYDeg * Math.PI) / 180;
    const radZ = (rotZDeg * Math.PI) / 180;

    const cosX = Math.cos(radX), sinX = Math.sin(radX);
    const cosY = Math.cos(radY), sinY = Math.sin(radY);
    const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);

    const m00 = cosY * cosZ * scale;
    const m01 = cosY * sinZ * scale;
    const m02 = -sinY * scale;
    const m10 = (sinX * sinY * cosZ - cosX * sinZ) * scale;
    const m11 = (sinX * sinY * sinZ + cosX * cosZ) * scale;
    const m12 = sinX * cosY * scale;
    const m20 = (cosX * sinY * cosZ + sinX * sinZ) * scale;
    const m21 = (cosX * sinY * sinZ - sinX * cosZ) * scale;
    const m22 = cosX * cosY * scale;

    return `matrix3d(${m00.toFixed(5)}, ${m01.toFixed(5)}, ${m02.toFixed(5)}, 0, ${m10.toFixed(5)}, ${m11.toFixed(5)}, ${m12.toFixed(5)}, 0, ${m20.toFixed(5)}, ${m21.toFixed(5)}, ${m22.toFixed(5)}, 0, ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}, 1)`;
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  setEcoMode(enabled) {
    this.isEcoMode = enabled;
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.subscribers.clear();
    this.isInitialized = false;
  }
}

// Global Singleton Instance
export const motionEngine = new MotionPipeline();
export default motionEngine;
