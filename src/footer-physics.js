const MAX_GLYPHS = 1500;
const CLUSTERS = ['oo.o', 'o:oo', 'o+o.', 'oo*o', ':o.o'];
const INKS = ['#313642', '#393f4d', '#3c435a'];
const TILE = 24;
const STIFFNESS = 110;
const DAMPING = 15;
const LINK_SELECTOR = 'a, button, input, select, textarea, summary, [tabindex]';

function createFooterField(canvas) {
  const footer = canvas.closest('.site-footer');
  const context = canvas.getContext('2d');
  if (!footer || !context) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const atlas = document.createElement('canvas');
  const atlasContext = atlas.getContext('2d');
  if (!atlasContext) return;

  let bounds;
  let width = 0;
  let height = 0;
  let ratio = 1;
  let particles = [];
  let visible = false;
  let focusedLink = false;
  let frame = 0;
  let lastTime = 0;
  let pointer = null;
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const allowed = () => visible && !document.hidden && !reducedMotion.matches && finePointer.matches;

  function makeAtlas() {
    atlas.width = Math.ceil(TILE * CLUSTERS.length * ratio);
    atlas.height = Math.ceil(TILE * INKS.length * ratio);
    atlasContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    atlasContext.font = '9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    atlasContext.textAlign = 'center';
    atlasContext.textBaseline = 'middle';
    INKS.forEach((ink, row) => {
      atlasContext.fillStyle = ink;
      CLUSTERS.forEach((cluster, column) => {
        for (let index = 0; index < cluster.length; index += 1) {
          atlasContext.fillText(cluster[index], column * TILE + 7 + index % 2 * 10, row * TILE + 7 + Math.floor(index / 2) * 10);
        }
      });
    });
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    // One bounded decorative canvas keeps the glyphs out of layout; an atlas avoids per-frame text shaping.
    for (const particle of particles) {
      context.globalAlpha = particle.alpha;
      context.drawImage(
        atlas,
        particle.glyph * TILE * ratio, particle.ink * TILE * ratio, TILE * ratio, TILE * ratio,
        particle.x + particle.dx - TILE / 2, particle.y + particle.dy - TILE / 2, TILE, TILE,
      );
    }
    context.globalAlpha = 1;
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
  }

  function reset() {
    stop();
    pointer = null;
    for (const particle of particles) {
      particle.dx = particle.dy = particle.vx = particle.vy = 0;
    }
  }

  function updateBounds() {
    bounds = footer.getBoundingClientRect();
  }

  function resize() {
    updateBounds();
    const nextWidth = Math.round(bounds.width);
    const nextHeight = Math.round(bounds.height);
    const nextRatio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(3000000 / Math.max(1, nextWidth * nextHeight)));
    if (nextWidth === width && nextHeight === height && nextRatio === ratio) return;
    reset();
    width = nextWidth;
    height = nextHeight;
    ratio = nextRatio;
    if (!width || !height) return;
    canvas.width = Math.ceil(width * ratio);
    canvas.height = Math.ceil(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    makeAtlas();

    let spacing = Math.max(17, Math.sqrt(width * height / MAX_GLYPHS));
    let columns = Math.max(1, Math.ceil(width / spacing));
    let rows = Math.max(1, Math.ceil(height / spacing));
    while (columns * rows > MAX_GLYPHS) {
      spacing += 0.5;
      columns = Math.max(1, Math.ceil(width / spacing));
      rows = Math.max(1, Math.ceil(height / spacing));
    }
    const radius = Math.min(230, Math.max(100, width * 0.18));
    const dimples = [
      { x: width * 0.23, y: height * 0.58, radius },
      { x: width * 0.72, y: height * 0.22, radius: radius * 1.12 },
      { x: width * 0.94, y: height * 0.92, radius: radius * 0.82 },
    ];
    particles = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column;
        let x = (column + 0.5) * width / columns;
        let y = (row + 0.5) * height / rows;
        let depth = 0;
        for (const dimple of dimples) {
          const dx = x - dimple.x;
          const dy = y - dimple.y;
          const weight = Math.exp(-(dx * dx + dy * dy) / (2 * dimple.radius * dimple.radius));
          x += dx / dimple.radius * weight * 25;
          y += dy / dimple.radius * weight * 25;
          depth = Math.max(depth, weight);
        }
        particles.push({
          x, y, dx: 0, dy: 0, vx: 0, vy: 0,
          glyph: (index * 7 + row * 3) % CLUSTERS.length,
          ink: index % 11 === 0 ? 2 : index % 3 === 0 ? 1 : 0,
          alpha: 0.85 - depth * 0.3,
        });
      }
    }
    draw();
  }

  function wake() {
    if (frame || !allowed()) return;
    lastTime = 0;
    frame = requestAnimationFrame(tick);
  }

  function tick(time) {
    frame = 0;
    if (!allowed()) {
      reset();
      return;
    }
    const elapsed = lastTime ? clamp((time - lastTime) / 1000, 1 / 240, 1 / 30) : 1 / 60;
    lastTime = time;
    // Substeps bound the spring at low frame rates without restarting its velocity on a new gesture.
    const steps = Math.ceil(elapsed / (1 / 120));
    const dt = elapsed / steps;
    const radius = Math.min(210, Math.max(135, width * 0.15));
    let moving = false;
    for (const particle of particles) {
      let targetX = 0;
      let targetY = 0;
      if (pointer && !focusedLink) {
        const dx = particle.x - pointer.x;
        const dy = particle.y - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance < radius) {
          const falloff = (1 - distance / radius) ** 2;
          // The center has no direction; a stable grid-based angle keeps division by zero out of the spring.
          const angle = distance > 0.01 ? Math.atan2(dy, dx) : (particle.glyph + particle.ink) * 1.2566;
          targetX = Math.cos(angle) * 42 * falloff;
          targetY = Math.sin(angle) * 42 * falloff;
        }
      }
      for (let step = 0; step < steps; step += 1) {
        particle.vx += ((targetX - particle.dx) * STIFFNESS - particle.vx * DAMPING) * dt;
        particle.vy += ((targetY - particle.dy) * STIFFNESS - particle.vy * DAMPING) * dt;
        particle.dx += particle.vx * dt;
        particle.dy += particle.vy * dt;
      }
      if (Math.abs(targetX - particle.dx) > 0.04 || Math.abs(targetY - particle.dy) > 0.04 || Math.abs(particle.vx) > 0.08 || Math.abs(particle.vy) > 0.08) {
        moving = true;
      } else {
        particle.dx = targetX;
        particle.dy = targetY;
        particle.vx = particle.vy = 0;
      }
    }
    draw();
    if (moving) frame = requestAnimationFrame(tick);
    else lastTime = 0;
  }

  function releasePointer() {
    if (!pointer) return;
    pointer = null;
    wake();
  }

  function pointerMove(event) {
    if (!allowed() || focusedLink || event.pointerType !== 'mouse') return;
    if (event.target instanceof Element && event.target.closest(`nav, ${LINK_SELECTOR}`)) {
      releasePointer();
      return;
    }
    if (!bounds) updateBounds();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    if (x < 0 || x > width || y < 0 || y > height) {
      releasePointer();
      return;
    }
    const deltaX = pointer ? clamp(x - pointer.x, -24, 24) : 0;
    const deltaY = pointer ? clamp(y - pointer.y, -24, 24) : 0;
    pointer = { x, y };
    const radius = Math.min(210, Math.max(135, width * 0.15));
    for (const particle of particles) {
      const distance = Math.hypot(particle.x - x, particle.y - y);
      if (distance >= radius) continue;
      const falloff = (1 - distance / radius) ** 2;
      // A small bounded impulse opposite mouse travel gives the anchored field a soft wake.
      particle.vx = clamp(particle.vx - deltaX * 0.85 * falloff, -200, 200);
      particle.vy = clamp(particle.vy - deltaY * 0.85 * falloff, -200, 200);
    }
    wake();
  }

  function preferenceChange() {
    reset();
    if (visible && !document.hidden) draw();
  }

  function visibilityChange() {
    reset();
    if (!document.hidden && visible) {
      updateBounds();
      draw();
    }
  }

  resize();
  visible = bounds.bottom > 0 && bounds.top < window.innerHeight;
  focusedLink = footer.contains(document.activeElement) && document.activeElement.matches(LINK_SELECTOR);
  footer.addEventListener('pointerenter', updateBounds, { passive: true });
  footer.addEventListener('pointermove', pointerMove, { passive: true });
  footer.addEventListener('pointerleave', releasePointer, { passive: true });
  footer.addEventListener('focusin', (event) => {
    focusedLink = event.target instanceof Element && event.target.matches(LINK_SELECTOR);
    if (focusedLink) releasePointer();
  });
  footer.addEventListener('focusout', (event) => {
    focusedLink = event.relatedTarget instanceof Element && footer.contains(event.relatedTarget) && event.relatedTarget.matches(LINK_SELECTOR);
  });
  window.addEventListener('scroll', () => {
    if (!visible) return;
    updateBounds();
    releasePointer();
  }, { passive: true });
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', visibilityChange);
  reducedMotion.addEventListener('change', preferenceChange);
  finePointer.addEventListener('change', preferenceChange);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(footer);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    reset();
    if (visible && !document.hidden) {
      updateBounds();
      draw();
    }
  });
  intersectionObserver.observe(footer);
}

document.querySelectorAll('canvas.footer-field').forEach(createFooterField);
