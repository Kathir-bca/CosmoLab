/* CosmoLab — 3D Black Hole Laboratory
 * Interactive educational visualization built with Three.js.
 * The geometry is illustrative, not a numerical GR ray-tracing solution.
 */
(function () {
  "use strict";

  let state = null;

  function makeLabel(container, text, className) {
    const el = document.createElement("div");
    el.className = "bh3d-label " + (className || "");
    el.textContent = text;
    container.appendChild(el);
    return el;
  }

  function initBlackHole3D() {
    const host = document.getElementById("bh3d");
    if (!host || !window.THREE || state) return;
    if (!window.WebGLRenderingContext) {
      host.innerHTML = '<div class="bh3d-fallback">WebGL is not available on this device.</div>';
      return;
    }

    const THREE = window.THREE;
    host.innerHTML = "";
    host.style.position = "relative";
    host.style.overflow = "hidden";
    host.style.touchAction = "none";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080b14);
    scene.fog = new THREE.FogExp2(0x080b14, 0.018);

    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 200);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x080b14, 1);
    if ("outputColorSpace" in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    if ("toneMapping" in renderer) renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.setAttribute("aria-label", "Interactive 3D black hole visualization");
    host.appendChild(renderer.domElement);

    const world = new THREE.Group();
    scene.add(world);

    const blackHole = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x000106 })
    );
    world.add(blackHole);

    const horizon = new THREE.Mesh(
      new THREE.SphereGeometry(1.22, 64, 64),
      new THREE.MeshBasicMaterial({
        color: 0x16233f,
        transparent: true,
        opacity: 0.12,
        side: THREE.BackSide
      })
    );
    world.add(horizon);

    const photonSphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 64, 64),
      new THREE.MeshBasicMaterial({
        color: 0x7fa8ff,
        wireframe: true,
        transparent: true,
        opacity: 0.20
      })
    );
    world.add(photonSphere);

    // Curved spacetime funnel/grid.
    const gridGroup = new THREE.Group();
    const size = 13;
    const segments = 34;
    const positions = [];

    function surfaceY(x, z) {
      const r = Math.sqrt(x * x + z * z);
      return -3.6 * Math.exp(-0.58 * r) - 0.12 / (r + 0.12);
    }

    for (let row = 0; row <= segments; row++) {
      const z = -size / 2 + size * row / segments;
      const pts = [];
      for (let col = 0; col <= segments; col++) {
        const x = -size / 2 + size * col / segments;
        pts.push(new THREE.Vector3(x, surfaceY(x, z), z));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      gridGroup.add(new THREE.Line(g, new THREE.LineBasicMaterial({
        color: 0x29406e, transparent: true, opacity: 0.42
      })));
    }

    for (let col = 0; col <= segments; col++) {
      const x = -size / 2 + size * col / segments;
      const pts = [];
      for (let row = 0; row <= segments; row++) {
        const z = -size / 2 + size * row / segments;
        pts.push(new THREE.Vector3(x, surfaceY(x, z), z));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      gridGroup.add(new THREE.Line(g, new THREE.LineBasicMaterial({
        color: 0x29406e, transparent: true, opacity: 0.42
      })));
    }
    world.add(gridGroup);

    // Accretion disk.
    const diskGroup = new THREE.Group();
    const disk = new THREE.Mesh(
      new THREE.RingGeometry(1.45, 4.35, 160, 8),
      new THREE.MeshBasicMaterial({
        color: 0xff7b2f,
        transparent: true,
        opacity: 0.58,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    disk.rotation.x = Math.PI / 2;
    diskGroup.add(disk);

    const innerGlow = new THREE.Mesh(
      new THREE.TorusGeometry(1.72, 0.12, 16, 160),
      new THREE.MeshBasicMaterial({
        color: 0xffd18a,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending
      })
    );
    innerGlow.rotation.x = Math.PI / 2;
    diskGroup.add(innerGlow);

    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.0 + i * 0.43, 0.025 + i * 0.008, 8, 160),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? 0xff6b32 : 0xffb15b,
          transparent: true,
          opacity: 0.34,
          blending: THREE.AdditiveBlending
        })
      );
      ring.rotation.x = Math.PI / 2;
      diskGroup.add(ring);
    }
    world.add(diskGroup);

    // Stylized bent light rays.
    const rayGroup = new THREE.Group();
    const rayColors = [0x8bb6ff, 0xd9e7ff, 0x9d8cff, 0xffc98a];
    for (let i = 0; i < 8; i++) {
      const y = -0.75 + i * 0.22;
      const side = i % 2 === 0 ? -1 : 1;
      const pts = [
        new THREE.Vector3(side * 6.4, y * 0.18, -2.5 + i * 0.3),
        new THREE.Vector3(side * 3.7, y * 0.30, -1.4 + i * 0.25),
        new THREE.Vector3(side * 2.1, y * 0.48, -0.55 + i * 0.14),
        new THREE.Vector3(side * 1.55, y * 0.62, 0.15 + i * 0.10),
        new THREE.Vector3(side * 2.5, y * 0.80, 0.95 + i * 0.18),
        new THREE.Vector3(side * 4.6, y * 0.92, 1.7 + i * 0.25)
      ];
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 40, 0.012, 5, false),
        new THREE.MeshBasicMaterial({
          color: rayColors[i % rayColors.length],
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending
        })
      );
      rayGroup.add(tube);
    }
    world.add(rayGroup);

    // Star field.
    const starCount = 700;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const radius = 28 + Math.random() * 55;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.cos(phi);
      starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({
      color: 0xa9c4ff, size: 0.075, transparent: true, opacity: 0.82
    }));
    scene.add(stars);

    // Lighting for the few shaded objects.
    scene.add(new THREE.AmbientLight(0x5b74aa, 0.65));
    const key = new THREE.PointLight(0xffa35c, 7, 20);
    key.position.set(3, 5, 2);
    scene.add(key);

    // HTML labels stay readable while the camera moves.
    const labels = {
      horizon: makeLabel(host, "EVENT HORIZON"),
      photon: makeLabel(host, "PHOTON SPHERE · 1.5 rₛ"),
      singularity: makeLabel(host, "BLACK HOLE")
    };

    const target = new THREE.Vector3(0, 0, 0);
    let radius = 15;
    let theta = 0.35;
    let phi = 1.05;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    function updateCamera() {
      phi = Math.max(0.32, Math.min(Math.PI - 0.32, phi));
      radius = Math.max(8, Math.min(28, radius));
      camera.position.set(
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.cos(theta)
      );
      camera.lookAt(target);
    }
    updateCamera();

    function resize() {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(280, host.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener("resize", resize, { passive: true });

    renderer.domElement.addEventListener("pointerdown", function (e) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      renderer.domElement.setPointerCapture?.(e.pointerId);
    });
    renderer.domElement.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      theta -= (e.clientX - lastX) * 0.008;
      phi -= (e.clientY - lastY) * 0.006;
      lastX = e.clientX;
      lastY = e.clientY;
      updateCamera();
    });
    renderer.domElement.addEventListener("pointerup", function () {
      dragging = false;
    });
    renderer.domElement.addEventListener("pointercancel", function () {
      dragging = false;
    });
    renderer.domElement.addEventListener("wheel", function (e) {
      e.preventDefault();
      radius += e.deltaY * 0.012;
      updateCamera();
    }, { passive: false });

    // Two-finger/mobile pinch.
    let pinchDistance = null;
    renderer.domElement.addEventListener("touchmove", function (e) {
      if (e.touches.length !== 2) return;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (pinchDistance !== null) radius -= (d - pinchDistance) * 0.015;
      pinchDistance = d;
      updateCamera();
    }, { passive: true });
    renderer.domElement.addEventListener("touchend", function () {
      pinchDistance = null;
    }, { passive: true });

    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "bh3d-reset";
    reset.textContent = "Reset view";
    reset.addEventListener("click", function () {
      radius = 15;
      theta = 0.35;
      phi = 1.05;
      updateCamera();
    });
    host.appendChild(reset);

    const hint = document.createElement("div");
    hint.className = "bh3d-hint";
    hint.textContent = "Drag to orbit · scroll/pinch to zoom";
    host.appendChild(hint);

    const clock = new THREE.Clock();

    function projectLabel(el, point, yOffset) {
      const p = point.clone().project(camera);
      const x = (p.x * 0.5 + 0.5) * host.clientWidth;
      const y = (-p.y * 0.5 + 0.5) * host.clientHeight;
      const visible = p.z < 1;
      el.style.transform = "translate(-50%, -50%) translate(" + x + "px," + (y + yOffset) + "px)";
      el.style.opacity = visible ? "1" : "0";
    }

    function animate() {
      if (document.hidden) {
        requestAnimationFrame(animate);
        return;
      }
      const t = clock.getElapsedTime();
      diskGroup.rotation.y = t * 0.16;
      innerGlow.rotation.z = t * 0.5;
      photonSphere.rotation.y = -t * 0.06;
      gridGroup.rotation.y = Math.sin(t * 0.08) * 0.02;
      stars.rotation.y = t * 0.003;
      rayGroup.rotation.y = Math.sin(t * 0.18) * 0.035;

      projectLabel(labels.horizon, new THREE.Vector3(0, 1.28, 0), 20);
      projectLabel(labels.photon, new THREE.Vector3(0, 1.62, 0), -4);
      projectLabel(labels.singularity, new THREE.Vector3(0, 0.15, 0), 0);

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    animate();

    state = { renderer: renderer, scene: scene };
  }

  window.initBlackHole3D = initBlackHole3D;
})();