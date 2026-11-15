"use client";

import { useEffect, useRef, useState } from "react";
import type { Group, Material, Object3D, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { asset } from "@/lib/asset";

type Rig = {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  load: (id: string) => Promise<Group>;
  frame: (model: Object3D) => void;
  current: Group | null;
  dispose: () => void;
};

// How long a model takes to blur out before the next one resolves in.
const SWAP_MS = 260;

/**
 * The live 3D stage. One renderer stays up while the visitor moves through
 * the fleet; each model is fetched once, dressed in the studio materials and
 * swapped in through a blur, so changing aircraft never flashes or jumps.
 * It turns slowly until touched; drag to turn it yourself.
 */
export function Stage({ id, label }: { id: string; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const rig = useRef<Rig | null>(null);
  const wanted = useRef(id);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [ready, setReady] = useState(false);

  // Build the renderer once.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let dead = false;
    let raf = 0;

    (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
      const { MeshoptDecoder } = await import("three/examples/jsm/libs/meshopt_decoder.module.js");
      if (dead) return;

      let renderer: WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      } catch {
        setState("failed");
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      el.appendChild(renderer.domElement);
      renderer.domElement.style.cssText = "display:block;width:100%;height:100%;touch-action:none;cursor:grab";

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.55;

      // The studio from the renders: a warm key, a cold rim from behind, a low amber kicker.
      const key = new THREE.DirectionalLight(0xfff6ea, 2.6);
      key.position.set(2.2, 3.4, 2.6);
      const rim = new THREE.DirectionalLight(0xa9e4ff, 1.5);
      rim.position.set(-2.6, 1.6, -3.2);
      const kicker = new THREE.DirectionalLight(0xffb35c, 0.9);
      kicker.position.set(3, 0.4, -1.5);
      scene.add(key, rim, kicker);

      const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
      const controls = new OrbitControls(camera, renderer.domElement);
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = false;
      controls.autoRotate = !still;
      controls.autoRotateSpeed = 0.7;
      controls.minPolarAngle = 0.15;
      controls.maxPolarAngle = Math.PI / 2 + 0.25;
      controls.addEventListener("start", () => {
        controls.autoRotate = false;
        renderer.domElement.style.cursor = "grabbing";
      });
      controls.addEventListener("end", () => {
        renderer.domElement.style.cursor = "grab";
      });

      const looks: Record<string, Material> = {
        "Printed carbon-nylon": new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.66, metalness: 0.08 }),
        "Carbon-fibre tube": new THREE.MeshPhysicalMaterial({
          color: 0x101114,
          roughness: 0.34,
          metalness: 0.3,
          clearcoat: 1,
          clearcoatRoughness: 0.08,
        }),
        "Motors and hardware": new THREE.MeshStandardMaterial({ color: 0xaab1ba, roughness: 0.28, metalness: 1 }),
        Electronics: new THREE.MeshStandardMaterial({
          color: 0x1f6b8f,
          roughness: 0.42,
          metalness: 0.25,
          emissive: 0x0d6f95,
          emissiveIntensity: 0.4,
        }),
        "Flexible TPU": new THREE.MeshStandardMaterial({ color: 0xe2702a, roughness: 0.85 }),
        Propellers: new THREE.MeshStandardMaterial({ color: 0x08090a, roughness: 0.42, metalness: 0.1 }),
        "Clear hatch": new THREE.MeshPhysicalMaterial({
          color: 0x9ed9f5,
          roughness: 0.08,
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
        }),
      };

      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      const cache = new Map<string, Promise<Group>>();
      const load = (name: string) => {
        let p = cache.get(name);
        if (!p) {
          p = loader.loadAsync(asset(`/models/${name}.glb`)).then((gltf) => {
            gltf.scene.traverse((o) => {
              const mesh = o as import("three").Mesh;
              if (!mesh.isMesh) return;
              const m = mesh.material as Material;
              mesh.material = looks[m.name.split(".")[0]] ?? m;
            });
            return gltf.scene;
          });
          cache.set(name, p);
        }
        return p;
      };

      const box = new THREE.Box3();
      const sphere = new THREE.Sphere();
      const frame = (model: Object3D) => {
        box.setFromObject(model).getBoundingSphere(sphere);
        const half = (camera.fov * Math.PI) / 360;
        // Fit the bounding sphere to the narrower of the two frame axes.
        const fit = sphere.radius / Math.sin(Math.atan(Math.tan(half) * Math.min(1, camera.aspect)));
        const d = fit * 0.92;
        const az = 0.62;
        const elev = 0.34;
        controls.target.copy(sphere.center);
        camera.position.set(
          sphere.center.x + d * Math.sin(az) * Math.cos(elev),
          sphere.center.y + d * Math.sin(elev),
          sphere.center.z + d * Math.cos(az) * Math.cos(elev),
        );
        camera.near = d / 100;
        camera.far = d * 20;
        camera.updateProjectionMatrix();
        controls.minDistance = d * 0.45;
        controls.maxDistance = d * 1.8;
        controls.autoRotate = !still;
        controls.update();
      };

      const resize = () => {
        const w = el.clientWidth;
        const h = el.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(resize);
      ro.observe(el);
      resize();

      const tick = () => {
        raf = requestAnimationFrame(tick);
        if (document.hidden) return;
        controls.update();
        renderer.render(scene, camera);
      };
      tick();

      rig.current = {
        renderer,
        scene,
        camera,
        controls,
        load,
        frame,
        current: null,
        dispose: () => {
          cancelAnimationFrame(raf);
          ro.disconnect();
          controls.dispose();
          pmrem.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        },
      };
      setReady(true);
    })();

    return () => {
      dead = true;
      rig.current?.dispose();
      rig.current = null;
    };
  }, []);

  // Swap the model whenever the aircraft changes.
  useEffect(() => {
    wanted.current = id;
    const r = rig.current;
    if (!ready || !r) return;
    setState("loading");
    const began = performance.now();
    r.load(id)
      .then(async (model) => {
        // Give the outgoing model time to blur out, even when the next is cached.
        const wait = r.current ? SWAP_MS - (performance.now() - began) : 0;
        if (wait > 0) await new Promise((res) => setTimeout(res, wait));
        if (wanted.current !== id || rig.current !== r) return;
        if (r.current) r.scene.remove(r.current);
        r.scene.add(model);
        r.current = model;
        r.frame(model);
        setState("ready");
      })
      .catch(() => {
        if (wanted.current === id) setState("failed");
      });
  }, [id, ready]);

  return (
    <div className="relative h-full w-full">
      <div
        ref={host}
        role="img"
        aria-label={`${label}, shown as a 3D model you can drag to turn.`}
        className="stage-canvas h-full w-full"
        data-state={state}
      />
      <p
        aria-live="polite"
        className={`pointer-events-none absolute inset-0 grid place-items-center px-6 text-center text-[16px] font-semibold text-plate-fg transition-opacity duration-300 ${
          state === "failed" ? "opacity-100" : "opacity-0"
        }`}
      >
        {state === "failed" ? "The 3D view could not start on this device." : ""}
      </p>
    </div>
  );
}
