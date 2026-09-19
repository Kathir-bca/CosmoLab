/* CosmoLab — Schwarzschild Black Hole Laboratory
 * Scale convention:
 *   r_s = 1.0  -> event-horizon radius
 *   r_ph = 1.5 -> photon-sphere radius
 *   r_ISCO = 3  -> ISCO radius for a non-rotating black hole
 *   r_shadow ≈ 2.598 -> apparent shadow radius for a distant observer
 *
 * This is a physically motivated educational 3D visualization.
 * It is NOT a numerical general-relativistic ray tracer.
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
    scene.background = new THREE.Color(0x05070d);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 180);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x05070d, 1);
    if ("outputColorSpace" in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    if ("toneMapping" in renderer) renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.setAttribute("aria-label", "Interactive 3D Schwarzschild black hole visualization");
    host.appendChild(renderer.domElement);

    const world = new THREE.Group();
    scene.add(world);

    // ---------------------------------------------------------------------
    // 1. Black-hole shadow / event horizon
    // ---------------------------------------------------------------------
    // The event horizon itself is not a glowing physical surface. We use a
    // black sphere at r_s only as the silhouette of the captured region.
    const eventHorizon = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 96, 64),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    world.add(eventHorizon);

    // A very subtle inner rim makes the silhouette readable without making
    // the horizon look like a solid glowing planet.
    const horizonRim = new THREE.Mesh(
      new THREE.RingGeometry(0.995, 1.012, 192),
      new THREE.MeshBasicMaterial({
        color: 0x2b3348,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide
      })
    );
    horizonRim.rotation.x = Math.PI / 2;
    world.add(horizonRim);

    // ---------------------------------------------------------------------
    // 2. Apparent black-hole shadow
    // ---------------------------------------------------------------------
    // For a distant observer, the shadow radius is sqrt(27)/2 * r_s.
    const shadowRadius = Math.sqrt(27) / 2;
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(shadowRadius, 192),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.96,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    // The disk is viewed obliquely, so the circular shadow is represented
    // in the observer-facing plane.
    shadow.rotation.x = Math.PI / 2;
    shadow.position.y = 0.012;
    world.add(shadow);

    const shadowEdge = new THREE.Mesh(
      new THREE.RingGeometry(shadowRadius * 0.985, shadowRadius * 1.015, 192),
      new THREE.MeshBasicMaterial({
        color: 0x283550,
        transparent: true,
        opacity: 0.30,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      })
    );
    shadowEdge.rotation.x = Math.PI / 2;
    shadowEdge.position.y = 0.018;
    world.add(shadowEdge);

    // ---------------------------------------------------------------------
    // 3. Photon sphere at exactly 1.5 r_s
    // ---------------------------------------------------------------------
    const photonSphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 96, 64),
      new THREE.MeshBasicMaterial({
        color: 0x7897d8,
        wireframe: true,
        transparent: true,
        opacity: 0.14
      })
    );
    world.add(photonSphere);

    // ---------------------------------------------------------------------
    // 4. Accretion disk: inner edge starts at ISCO = 3 r_s
    // ---------------------------------------------------------------------
    // A thin disk is appropriate for the educational Schwarzschild case.
    // Its inner edge is kept outside the ISCO; material inside this radius
    // is not shown as a stable circular orbit.
    const diskGroup = new THREE.Group();
    diskGroup.rotation.x = Math.PI / 2;

    const disk = new THREE.Mesh(
      new THREE.RingGeometry(3.05, 7.5, 256, 12),
      new THREE.MeshBasicMaterial({
        color: 0xff6428,
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    diskGroup.add(disk);

    const diskRings = [];
    for (let i = 0; i < 10; i++) {
      const r = 3.08 + i * 0.45;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.035 + (9 - i) * 0.0025, 8, 192),
        new THREE.MeshBasicMaterial({
          color: i < 3 ? 0xffd08a : 0xff7a32,
          transparent: true,
          opacity: i < 3 ? 0.72 : 0.30,
          blending: THREE.AdditiveBlending
        })
      );
      diskGroup.add(ring);
      diskRings.push(ring);
    }

    // Bright inner edge around the ISCO.
    const iscoGlow = new THREE.Mesh(
      new THREE.TorusGeometry(3.04, 0.075, 16, 256),
      new THREE.MeshBasicMaterial({
        color: 0xffe0a6,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending
      })
    );
    diskGroup.add(iscoGlow);

    world.add(diskGroup);

    // ---------------------------------------------------------------------
    // 5. Curved spacetime illustration
    // ---------------------------------------------------------------------
    // This is an embedding-style visual aid, not a literal spatial surface.
    const gridGroup = new THREE.Group();
    const size = 18;
    const segments = 48;

    function funnelY(x, z) {
      const r = Math.sqrt(x * x + z * z);
      return -2.8 / Math.sqrt(r * r + 0.65) + 0.95;
    }

    const gridMaterial = new THREE.LineBasicMaterial({
      color: 0x315184,
      transparent: true,
      opacity: 0.34
    });

    for (let row = 0; row <= segments; row++) {
      const z = -size / 2 + size * row / segments;
      const points = [];
      for (let col = 0; col <= segments; col++) {
        const x = -size / 2 + size * col / segments;
        points.push(new THREE.Vector3(x, funnelY(x, z), z));
      }
      gridGroup.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        gridMaterial
      ));
    }

    for (let col = 0; col <= segments; col++) {
      const x = -size / 2 + size * col / segments;
      const points = [];
      for (let row = 0; row <= segments; row++) {
        const z = -size / 2 + size * row / segments;
        points.push(new THREE.Vector3(x, funnelY(x, z), z));
      }
      gridGroup.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        gridMaterial
      ));
    }

    // Keep the embedding diagram below the physical disk.
    gridGroup.position.y = -0.35;
    world.add(gridGroup);

    // ---------------------------------------------------------------------
    // 6. Qualitative light-bending paths
    // ---------------------------------------------------------------------
    // These paths communicate gravitational deflection. They are deliberately
    // labelled as illustrative rather than claiming exact ray-tracing.
    const rayGroup = new THREE.Group();

    function addBentRay(points, color, opacity) {
      const curve = new THREE.CatmullRomCurve3(points);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 72, 0.012, 6, false),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity,
          blending: THREE.AdditiveBlending
        })
      );
      rayGroup.add(tube);
    }

    for (let i = -3; i <= 3; i++) {
      const z = i * 0.34;
      addBentRay([
        new THREE.Vector3(-8.5, 2.5 + i * 0.10, z - 2.0),
        new THREE.Vector3(-5.4, 2.0 + i * 0.07, z - 1.0),
        new THREE.Vector3(-3.5, 1.5 + i * 0.04, z - 0.42),
        new THREE.Vector3(-2.65, 1.15, z),
        new THREE.Vector3(-3.6, 1.45 + i * 0.04, z + 0.42),
        new THREE.Vector3(-5.4, 1.95 + i * 0.07, z + 1.0),
        new THREE.Vector3(-8.5, 2.5 + i * 0.10, z + 2.0)
      ], i === 0 ? 0xe9f2ff : 0x8caeff, i === 0 ? 0.70 : 0.34);
    }

    world.add(rayGroup);

    // ---------------------------------------------------------------------
    // 7. Stars
    // ---------------------------------------------------------------------
    const starCount = 850;
    const starPositions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const radius = 24 + Math.random() * 60;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.cos(phi);
      starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }

    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(starPositions, 3)
    );

    scene.add(new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: 0xaec4ed,
        size: 0.065,
        transparent: true,
        opacity: 0.78
      })
    ));

    // Minimal lighting; the black hole itself remains unlit.
    scene.add(new THREE.AmbientLight(0x34456b, 0.35));
    const diskLight = new THREE.PointLight(0xff9c55, 4.5, 24);
    diskLight.position.set(3, 4, 2);
    scene.add(diskLight);

    // ---------------------------------------------------------------------
    // Labels
    // ---------------------------------------------------------------------
    const labels = {
      horizon: makeLabel(host, "EVENT HORIZON · rₛ"),
      photon: makeLabel(host, "PHOTON SPHERE · 1.5 rₛ"),
      isco: makeLabel(host, "ISCO · 3 rₛ"),
      shadow: makeLabel(host, "BLACK-HOLE SHADOW · 2.60 rₛ")
    };

    const target = new THREE.Vector3(0, 0, 0);
    let radius = 17;
    let theta = 0.40;
    let phi = 1.03;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    function updateCamera() {
      phi = Math.max(0.30, Math.min(Math.PI - 0.30, phi));
      radius = Math.max(9, Math.min(34, radius));

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
      const h = Math.max(300, host.clientHeight);
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
      radius += e.deltaY * 0.014;
      updateCamera();
    }, { passive: false });

    let pinchDistance = null;

    renderer.domElement.addEventListener("touchmove", function (e) {
      if (e.touches.length !== 2) return;

      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (pinchDistance !== null) {
        radius -= (distance - pinchDistance) * 0.015;
        updateCamera();
      }

      pinchDistance = distance;
    }, { passive: true });

    renderer.domElement.addEventListener("touchend", function () {
      pinchDistance = null;
    }, { passive: true });

    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "bh3d-reset";
    reset.textContent = "Reset view";
    reset.addEventListener("click", function () {
      radius = 17;
      theta = 0.40;
      phi = 1.03;
      updateCamera();
    });
    host.appendChild(reset);

    const hint = document.createElement("div");
    hint.className = "bh3d-hint";
    hint.textContent = "Drag to orbit · scroll/pinch to zoom";
    host.appendChild(hint);

    const clock = new THREE.Clock();

    function projectLabel(el, point, yOffset) {
      const projected = point.clone().project(camera);
      const x = (projected.x * 0.5 + 0.5) * host.clientWidth;
      const y = (-projected.y * 0.5 + 0.5) * host.clientHeight;
      const visible = projected.z < 1;

      el.style.transform =
        "translate(-50%, -50%) translate(" + x + "px," + (y + yOffset) + "px)";
      el.style.opacity = visible ? "1" : "0";
    }

    function animate() {
      requestAnimationFrame(animate);

      if (document.hidden) return;

      const t = clock.getElapsedTime();

      // Material orbiting around the black hole. The black hole itself never
      // spins in this Schwarzschild visualization.
      diskGroup.rotation.y = t * 0.12;
      photonSphere.rotation.y = -t * 0.025;

      // Very subtle motion keeps the spacetime diagram alive without implying
      // that spacetime is literally rotating.
      rayGroup.position.y = Math.sin(t * 0.25) * 0.015;

      projectLabel(labels.horizon, new THREE.Vector3(0, 1.03, 0), 20);
      projectLabel(labels.photon, new THREE.Vector3(0, 1.52, 0), -4);
      projectLabel(labels.isco, new THREE.Vector3(3.1, 0.10, 0), 2);
      projectLabel(labels.shadow, new THREE.Vector3(-2.55, 0.05, 0), 2);

      renderer.render(scene, camera);
    }

    animate();

    state = { renderer, scene };
  }

  window.initBlackHole3D = initBlackHole3D;
})();