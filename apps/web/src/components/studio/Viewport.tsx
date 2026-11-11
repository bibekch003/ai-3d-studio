"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Edges, Grid, OrbitControls, TransformControls } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import {
  sampleScene,
  type PbrMaterial,
  type SampledTransform,
  type SceneDocument,
  type SceneObject,
} from "@ai3d/scene-core";
import { useStudio } from "@/lib/store";
import { setViewportCanvas } from "@/lib/viewport-bridge";

/**
 * Three.js viewport.
 *
 * The viewport is a *view* of the scene document, never the source of truth.
 * Playback works by sampling the animation clips at the current frame and
 * applying the result to the rendered groups — the document is untouched, so
 * scrubbing is free and nothing is baked.
 */

const FALLBACK_COLOR = "#9ca3af";

function resolveMaterial(scene: SceneDocument, obj: SceneObject): PbrMaterial | null {
  const base = scene.materials.find((m) => m.id === obj.material_id) ?? null;
  if (!base && !obj.material_overrides) return null;
  return {
    ...(base ?? { id: "inline", name: "inline", base_color: FALLBACK_COLOR, roughness: 0.7, metallic: 0 }),
    ...(obj.material_overrides ?? {}),
  };
}

function Geometry({ obj }: { obj: SceneObject }) {
  const g = obj.geometry;
  if (g.kind !== "primitive") {
    if (g.kind === "asset" || g.kind === "procedural") return <boxGeometry args={[0.4, 0.4, 0.4]} />;
    return null;
  }
  const p = g.params as Record<string, number>;
  switch (g.primitive) {
    case "box":
      return <boxGeometry args={[p.width ?? p.size ?? 1, p.height ?? p.size ?? 1, p.depth ?? p.size ?? 1]} />;
    case "sphere":
      return <sphereGeometry args={[p.radius ?? 0.5, 32, 24]} />;
    case "cylinder":
      return <cylinderGeometry args={[p.radius ?? 0.3, p.radius ?? 0.3, p.depth ?? p.height ?? 1, 24]} />;
    case "cone":
      return <coneGeometry args={[p.radius ?? 0.4, p.height ?? 1, 24]} />;
    case "torus":
      return <torusGeometry args={[p.radius ?? 0.4, p.tube ?? 0.12, 16, 48]} />;
    case "capsule":
      return <capsuleGeometry args={[p.radius ?? 0.2, p.length ?? 0.6, 8, 16]} />;
    case "plane":
      return <planeGeometry args={[p.size ?? 1, p.size ?? 1]} />;
    default:
      return <boxGeometry args={[1, 1, 1]} />;
  }
}

/** Object3D registry so the gizmo can attach to the selected node by id. */
const registry = new Map<string, THREE.Object3D>();

function SceneNode({
  obj,
  scene,
  selectedIds,
  hoveredId,
  sampled,
}: {
  obj: SceneObject;
  scene: SceneDocument;
  selectedIds: string[];
  hoveredId: string | null;
  sampled: Map<string, SampledTransform>;
}) {
  const selected = selectedIds.includes(obj.id);
  const hovered = hoveredId === obj.id;
  const select = useStudio((s) => s.select);
  const hover = useStudio((s) => s.hover);
  const material = resolveMaterial(scene, obj);
  const children = scene.objects.filter((o) => o.parent_id === obj.id);

  const override = sampled.get(obj.id);
  const position = override?.position ?? obj.transform.position;
  const rotation = override?.rotation ?? obj.transform.rotation;
  const scale = override?.scale ?? obj.transform.scale;
  const visible = override?.visible ?? obj.visible;

  const isMeshCandidate =
    !["camera", "light", "audio", "group", "environment"].includes(obj.type) && obj.geometry.kind !== "none";
  const colour = material?.base_color ?? FALLBACK_COLOR;

  return (
    <group
      ref={(node) => {
        if (node) registry.set(obj.id, node);
        else registry.delete(obj.id);
      }}
      position={position}
      rotation={rotation}
      scale={scale}
      visible={visible}
      name={obj.id}
    >
      {isMeshCandidate ? (
        <mesh
          castShadow
          receiveShadow
          onClick={(e) => {
            e.stopPropagation();
            select(obj.id, e.shiftKey || e.nativeEvent.shiftKey ? "add" : "replace");
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            hover(obj.id);
          }}
          onPointerOut={() => hover(null)}
          rotation={obj.geometry.kind === "primitive" && obj.geometry.primitive === "plane" ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}
        >
          <Geometry obj={obj} />
          <meshStandardMaterial
            color={colour}
            roughness={material?.roughness ?? 0.7}
            metalness={material?.metallic ?? 0}
            emissive={material?.emissive ?? "#000000"}
            emissiveIntensity={material?.emissive_strength ?? 0}
            transparent={(material?.opacity ?? 1) < 1}
            opacity={material?.opacity ?? 1}
            wireframe={hovered && !selected}
          />
          {selected ? <Edges color="#fbbf24" threshold={15} /> : null}
        </mesh>
      ) : null}

      {/* Asset-backed characters render as a silhouette so they stay clickable. */}
      {obj.type === "character" ? (
        <mesh
          position={[0, 0.95, 0]}
          onClick={(e) => {
            e.stopPropagation();
            select(obj.id, e.shiftKey || e.nativeEvent.shiftKey ? "add" : "replace");
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            hover(obj.id);
          }}
          onPointerOut={() => hover(null)}
        >
          <capsuleGeometry args={[0.18, 0.9, 8, 16]} />
          <meshStandardMaterial color="#c98d6b" roughness={0.6} transparent opacity={0.85} wireframe={hovered && !selected} />
          {selected ? <Edges color="#fbbf24" threshold={15} /> : null}
        </mesh>
      ) : null}

      {children.map((child) => (
        <SceneNode
          key={child.id}
          obj={child}
          scene={scene}
          selectedIds={selectedIds}
          hoveredId={hoveredId}
          sampled={sampled}
        />
      ))}
    </group>
  );
}

function Lights({ scene }: { scene: SceneDocument }) {
  const lights = scene.objects.filter((o) => o.type === "light" && o.visible && o.light);
  return (
    <>
      <ambientLight intensity={0.18} />
      {lights.map((obj) => {
        const light = obj.light!;
        const intensity = Math.min(6, Math.max(0.2, light.intensity_watts / 60));
        if (light.kind === "sun") {
          return (
            <directionalLight key={obj.id} position={obj.transform.position} intensity={intensity} color={light.color} castShadow>
              <orthographicCamera attach="shadow-camera" args={[-6, 6, 6, -6, 0.1, 40]} />
            </directionalLight>
          );
        }
        if (light.kind === "spot") {
          return (
            <spotLight
              key={obj.id}
              position={obj.transform.position}
              angle={((light.angle_deg ?? 45) * Math.PI) / 180}
              penumbra={light.softness}
              intensity={intensity * 3}
              color={light.color}
              castShadow={light.shadows}
            />
          );
        }
        return (
          <pointLight key={obj.id} position={obj.transform.position} intensity={intensity * 2.2} color={light.color} castShadow={false} />
        );
      })}
    </>
  );
}

function CameraRig({ scene }: { scene: SceneDocument }) {
  const camera = scene.objects.find((o) => o.id === scene.active_camera_id && o.camera);
  const focal = camera?.camera?.focal_length_mm ?? 35;
  const sensor = camera?.camera?.sensor_width_mm ?? 36;
  const fov = 2 * Math.atan(sensor / (2 * focal)) * (180 / Math.PI);
  const { camera: threeCamera } = useThree();

  useEffect(() => {
    if (threeCamera instanceof THREE.PerspectiveCamera) {
      threeCamera.fov = fov;
      threeCamera.updateProjectionMatrix();
    }
  }, [fov, threeCamera]);

  return null;
}

/** Registers the drawing buffer so the recorder can capture it. */
function CanvasBridge() {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    setViewportCanvas(gl.domElement);
    return () => setViewportCanvas(null);
  }, [gl]);
  return null;
}

function TransformGizmo() {
  const scene = useStudio((s) => s.scene);
  const selection = useStudio((s) => s.selection);
  const gizmo = useStudio((s) => s.gizmo);
  const playing = useStudio((s) => s.playing);
  const applyOps = useStudio((s) => s.applyOps);
  const [target, setTarget] = useState<THREE.Object3D | null>(null);
  const primaryId = selection[0] ?? null;

  useEffect(() => {
    setTarget(primaryId ? registry.get(primaryId) ?? null : null);
  }, [primaryId, scene.revision]);

  if (!target || !primaryId || playing) return null;

  return (
    <TransformControls
      object={target}
      mode={gizmo}
      size={0.8}
      onMouseUp={() => {
        const obj = scene.objects.find((o) => o.id === primaryId);
        if (!obj) return;
        const round = (n: number) => Math.round(n * 1000) / 1000;
        applyOps(
          [
            {
              op: "set_transform",
              target_id: primaryId,
              params: {
                position: [round(target.position.x), round(target.position.y), round(target.position.z)],
                rotation: [round(target.rotation.x), round(target.rotation.y), round(target.rotation.z)],
                scale: [round(target.scale.x), round(target.scale.y), round(target.scale.z)],
              },
            },
          ],
          `Transform ${obj.name}`,
        );
      }}
    />
  );
}

export default function Viewport() {
  const scene = useStudio((s) => s.scene);
  const selection = useStudio((s) => s.selection);
  const hovered = useStudio((s) => s.hovered);
  const frame = useStudio((s) => s.frame);
  const playing = useStudio((s) => s.playing);
  const clearSelection = useStudio((s) => s.clearSelection);

  const roots = useMemo(() => scene.objects.filter((o) => o.parent_id === null), [scene.objects]);
  const sampled = useMemo(() => sampleScene(scene, frame).transforms, [scene, frame]);

  const background = scene.environment.sky.color || "#101012";

  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [0.6, 1.8, 4.6], fov: 48, near: 0.05, far: 200 }}
        onPointerMissed={() => clearSelection()}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
      >
        <color attach="background" args={[background]} />
        <fog attach="fog" args={[background, 14, 48]} />
        <CanvasBridge />
        <CameraRig scene={scene} />
        <Lights scene={scene} />
        <Grid
          args={[24, 24]}
          cellSize={0.5}
          cellThickness={0.6}
          cellColor="#2a2a31"
          sectionSize={2}
          sectionThickness={1}
          sectionColor="#3a3a44"
          fadeDistance={26}
          fadeStrength={1.2}
          infiniteGrid
          position={[0, -0.02, 0]}
        />
        <ContactShadows position={[0, 0.001, 0]} opacity={0.35} scale={18} blur={2.4} far={6} />
        {roots.map((obj) => (
          <SceneNode
            key={obj.id}
            obj={obj}
            scene={scene}
            selectedIds={selection}
            hoveredId={hovered}
            sampled={sampled}
          />
        ))}
        <TransformGizmo />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={0.6} maxDistance={30} target={[0, 1, -0.4]} enabled={!playing} />
      </Canvas>

      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1 text-2xs text-neutral-400">
        <span className="rounded bg-neutral-950/70 px-2 py-1 font-mono">
          {selection.length ? `${selection.length} selected` : "click an object"} · {scene.objects.length} objects
        </span>
        {playing ? (
          <span className="rounded bg-amber-400/20 px-2 py-1 font-mono text-amber-200">playing frame {Math.round(frame)}</span>
        ) : null}
        {scene.animations.length === 0 ? (
          <span className="rounded bg-neutral-950/70 px-2 py-1">No animation yet — add a clip in the AI panel or timeline.</span>
        ) : null}
      </div>
    </div>
  );
}
