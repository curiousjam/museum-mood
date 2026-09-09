'use client';
/* eslint-disable next/no-img-element -- Locally resized images are transformed directly by the gesture renderer. */
/* eslint-disable next/no-html-link-for-pages -- Full navigation deliberately leaves this isolated prototype. */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions -- The explorer delegates keyboard shortcuts and pointer gestures; equivalent buttons are provided. */
/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The named painting region is intentionally focusable for keyboard exploration. */

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { flushSync } from 'react-dom';
import { gsap } from 'gsap';
import {
  ArrowUp,
  ArrowDown,
  Minus,
  Plus,
  X,
  RotateCcw,
  Pause,
  Play,
} from 'lucide-react';
import {
  enabledMoods,
  motionArtworks,
  eyeCamera,
  fullCamera,
  boundCamera,
  nextArtwork,
  swipeDirection,
  spotsFor,
  reactionCamera,
  type ArtworkRecord,
  type Camera,
  type MoodDefinition,
  type Phase,
} from '@/lib/motion';
import type { MoodId } from '@/lib/moods';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import s from './motion.module.css';

type Point = { x: number; y: number };
function MoodFace({ id }: { id: MoodId }) {
  return <svg viewBox="0 0 24 18" width="24" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
    <g className={s.faceFeatures}>
    {id === 'judging' ? <><path d="M3 5h7m4 0h7M7 12h10"/><path d="M7 5v2m10-2v2"/></> : id === 'suspicious' ? <><path d="m3 3 7 3m4 0 7-3M8 13l8-1"/><path d="M7 7v2m10-2v2"/></> : id === 'panicking' ? <><circle cx="7" cy="5" r="2"/><circle cx="17" cy="5" r="2"/><ellipse cx="12" cy="14" rx="2.5" ry="3"/></> : <><path d="M4 4h6m4 2h6M7 6v2m10 0v2m-9 5q4-4 8 0"/></>}
    </g>
  </svg>;
}
function previewCamera(art: ArtworkRecord): Camera {
  if (art.objectId === 435997) {
    const paired = spotsFor(art)[0];
    return paired ? reactionCamera(art, paired) : eyeCamera(art);
  }
  const eye = eyeCamera(art);
  return boundCamera({ ...eye, width: eye.width * 1.65, y: eye.y + .018 }, art);
}
type Pose = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  clip: number;
  swipe: number;
};

/** Shared by production and the eight-mood layout fixture; never shrink emoji targets. */
export function MoodDock({
  moods,
  selected,
  onSelect,
}: {
  moods: MoodDefinition[];
  selected: MoodId;
  onSelect: (mood: MoodDefinition) => void;
}) {
  return (
    <RadioGroup
      className={s.dock}
      value={selected}
      onValueChange={(value) => {
        const next = moods.find((m) => m.id === value);
        if (next) onSelect(next);
      }}
      aria-label="how are we feeling?"
    >
      {moods.map((m, index) => (
        <label key={m.id} className={s.mood} data-selected={selected === m.id}>
          <RadioGroupItem
            className={s.radio}
            value={m.id}
            aria-label={m.label}
            onClick={() => {
              if (selected === m.id) onSelect(m);
            }}
            onFocus={(event) =>
              event.currentTarget.scrollIntoView({
                block: 'nearest',
                inline: 'nearest',
              })
            }
          />
          <span className={s.emoji} aria-hidden="true">
            <MoodFace id={m.id} />
          </span>
          <span className={s.moodIndex} aria-hidden="true">0{index + 1}</span>
          <span aria-hidden="true">{m.label}</span>
        </label>
      ))}
    </RadioGroup>
  );
}

export default function MotionGallery({
  moods = enabledMoods,
  records = motionArtworks,
}: { moods?: MoodDefinition[]; records?: ArtworkRecord[] } = {}) {
  function getArtwork(id: number) {
    const record = records.find((a) => a.objectId === id);
    if (!record) throw Error(`Unknown artwork ${id}`);
    return record;
  }
  const initialMood = moods.find((m) => m.id === 'judging') ?? moods[0];
  const initialArt = getArtwork(initialMood.featuredArtworkId!);
  const [mood, setMood] = useState(initialMood);
  const [art, setArt] = useState(initialArt);
  const [phase, setPhase] = useState<Phase>('cluster');
  const [src, setSrc] = useState(initialArt.thumbnail);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [spotIndex, setSpotIndex] = useState(0);
  const [showSpots, setShowSpots] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);
  const root = useRef<HTMLElement>(null);
  const markers = useRef(new Map<string, HTMLButtonElement>());
  const stage = useRef<HTMLDivElement>(null),
    target = useRef<HTMLDivElement>(null),
    cluster = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLElement>(null),
    mask = useRef<HTMLDivElement>(null),
    painting = useRef<HTMLImageElement>(null);
  const tiles = useRef(new Map<number, HTMLButtonElement>());
  const engine = useRef({
    art: initialArt,
    mood: initialMood,
    phase: 'cluster' as Phase,
    camera: eyeCamera(initialArt),
    pose: { x: 0, y: 0, scale: 1, rotation: 0, clip: 1, swipe: 0 } as Pose,
    w: 0,
    h: 0,
    p: 0,
    reduced: false,
    request: 0,
    pendingId: 0,
    spotIndex: 0,
  });
  const remembered = useRef(new Map<MoodId, number>());
  const cache = useRef(new Map<number, Promise<string>>());
  const drift = useRef({ amount: 0 });
  const retryAction = useRef<() => void>(() => {});
  const points = useRef(new Map<number, Point>());
  const gesture = useRef({
    start: { x: 0, y: 0 },
    last: { x: 0, y: 0 },
    time: 0,
    lastTime: 0,
    velocity: 0,
    pinch: 0,
    camera: eyeCamera(initialArt),
    pinched: false,
  });
  const open = phase !== 'cluster';
  const expressions = spotsFor(art);
  const expression = expressions[spotIndex] ?? expressions[0];
  function currentCamera() {
    const e = engine.current;
    return reactionCamera(
      e.art,
      spotsFor(e.art)[e.spotIndex] ?? spotsFor(e.art)[0],
    );
  }
  function selectSpot(index: number) {
    if (
      [...markers.current.values()].some(
        (marker) => marker === document.activeElement,
      )
    )
      frame.current?.focus({ preventScroll: true });
    const e = engine.current;
    const list = spotsFor(e.art);
    e.spotIndex = (index + list.length) % list.length;
    setSpotIndex(e.spotIndex);
    animateCamera(currentCamera(), 'browsing');
  }

  function changePhase(next: Phase) {
    engine.current.phase = next;
    setPhase(next);
  }
  function stop() {
    settleDrift();
    gsap.killTweensOf(engine.current.camera);
    gsap.killTweensOf(engine.current.pose);
  }
  function driftCamera(): Camera {
    const e = engine.current;
    return {
      ...e.camera,
      width: e.camera.width * (1 - drift.current.amount * 0.025),
    };
  }
  function settleDrift() {
    gsap.killTweensOf(drift.current);
    Object.assign(engine.current.camera, driftCamera());
    drift.current.amount = 0;
  }
  function paint() {
    const e = engine.current;
    if (!frame.current || !mask.current || !painting.current || !e.w) return;
    const { pose, w, h, p } = e;
    const camera = driftCamera();
    frame.current.style.transform = `translate3d(${pose.x}px,${pose.y + pose.swipe}px,0) scale(${pose.scale}) rotate(${pose.rotation}deg)`;
    mask.current.style.clipPath = `inset(${Math.max(0, (p - h) / 2) * pose.clip}px 0)`;
    const scale = 1 / camera.width;
    painting.current.style.transform = `translate3d(${w / 2 - camera.x * w * scale}px,${p / 2 - camera.y * ((w * e.art.height) / e.art.width) * scale}px,0) scale(${scale})`;
    for (const spot of spotsFor(e.art)) {
      const marker = markers.current.get(spot.id);
      if (!marker) continue;
      const c = spot.full ? eyeCamera(e.art) : reactionCamera(e.art, spot);
      marker.style.left = `${w / 2 + (c.x - camera.x) * w * scale}px`;
      marker.style.top = `${h / 2 + (((c.y - camera.y) * w * e.art.height) / e.art.width) * scale}px`;
    }
  }
  function measure() {
    const e = engine.current;
    if (
      !target.current ||
      !stage.current ||
      !frame.current ||
      !mask.current ||
      !painting.current
    )
      return;
    const rect = target.current.getBoundingClientRect(),
      stageRect = stage.current.getBoundingClientRect();
    e.w = rect.width;
    e.h = (rect.width * 9) / 16;
    e.p = Math.max(e.h, (e.w * e.art.height) / e.art.width);
    Object.assign(frame.current.style, {
      left: `${rect.left - stageRect.left}px`,
      top: `${rect.top - stageRect.top}px`,
      width: `${e.w}px`,
      height: `${e.h}px`,
    });
    Object.assign(mask.current.style, {
      width: `${e.w}px`,
      height: `${e.p}px`,
      top: `${(e.h - e.p) / 2}px`,
    });
    Object.assign(painting.current.style, {
      width: `${e.w}px`,
      height: `${(e.w * e.art.height) / e.art.width}px`,
    });
    paint();
  }
  function tilePose(id: number, includeHover = false, startRect?: DOMRect, destinationRect?: DOMRect) {
    const tile = tiles.current.get(id),
      destination = target.current;
    if (!tile || !destination)
      return { x: 0, y: 0, scale: 0.15, rotation: 0, clip: 0, swipe: 0 };
    const visual = tile.querySelector<HTMLElement>('[data-motion-preview]') ?? tile;
    const a = startRect ?? visual.getBoundingClientRect(),
      b = destinationRect ?? destination.getBoundingClientRect();
    const style = getComputedStyle(tile);
    // Continue opening from the hovered size, including an interrupted hover tween.
    const magnification = includeHover ? parseFloat(style.scale) || 1 : 1;
    return {
      x: a.left + a.width / 2 - b.left - b.width / 2,
      y: a.top + a.height / 2 - b.top - b.height / 2,
      scale: (visual.offsetWidth * magnification) / b.width,
      rotation: parseFloat(style.rotate) || 0,
      clip: (Math.max(9 / 16, engine.current.art.height / engine.current.art.width) - visual.offsetHeight / visual.offsetWidth) / Math.max(.001, Math.max(9 / 16, engine.current.art.height / engine.current.art.width) - 9 / 16),
      swipe: 0,
    };
  }
  function loadDetail(record: ArtworkRecord) {
    let promise = cache.current.get(record.objectId);
    if (!promise) {
      promise = new Promise<string>((resolve, reject) => {
        const img = new Image();
        const timeout = setTimeout(() => {
          img.src = '';
          reject(Error('this painting is taking a while. try again?'));
        }, 12000);
        img.src = record.image;
        img.decode().then(
          () => {
            clearTimeout(timeout);
            resolve(record.image);
          },
          () => {
            clearTimeout(timeout);
            reject(Error('couldn’t load this painting. try again?'));
          },
        );
      });
      cache.current.set(record.objectId, promise);
      promise.catch(() => cache.current.delete(record.objectId));
    }
    return promise;
  }
  function prefetch() {
    const e = engine.current;
    const id = nextArtwork(e.mood, e.art.objectId, 1);
    for (const cached of cache.current.keys())
      if (cached !== e.art.objectId && cached !== id)
        cache.current.delete(cached);
    void loadDetail(getArtwork(id)).catch(() => {});
  }
  async function enhance(record: ArtworkRecord, request: number) {
    setLoading(true);
    setFailed(false);
    try {
      const detail = await loadDetail(record);
      if (request !== engine.current.request) return;
      setSrc(detail);
      setNotice('');
      prefetch();
    } catch (error) {
      if (request !== engine.current.request) return;
      retryAction.current = () => {
        void enhance(record, ++engine.current.request);
      };
      setNotice((error as Error).message);
      setFailed(true);
    } finally {
      if (request === engine.current.request) setLoading(false);
    }
  }
  function animateCamera(camera: Camera, mode: Phase) {
    const e = engine.current;
    stop();
    points.current.clear();
    e.pendingId = 0;
    ++e.request;
    setLoading(false);
    setFailed(false);
    setNotice('');
    changePhase(mode);
    setShowSpots(false);
    gsap.to(e.pose, {
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      clip: 1,
      swipe: 0,
      duration: e.reduced ? 0 : 0.35,
      onUpdate: paint,
    });
    gsap.to(e.camera, {
      ...boundCamera(camera, e.art),
      duration: e.reduced ? 0 : 0.4,
      ease: 'power3.out',
      onUpdate: paint,
    });
    void enhance(e.art, e.request);
  }
  function openArt(record: ArtworkRecord) {
    const e = engine.current;
    stop();
    points.current.clear();
    const request = ++e.request;
    e.pendingId = 0;
    e.art = record;
    e.spotIndex = 0;
    setSpotIndex(0);
    setShowSpots(false);
    remembered.current.set(e.mood.id, record.objectId);
    Object.assign(e.camera, previewCamera(record));
    const startRect = tiles.current.get(record.objectId)?.querySelector('[data-motion-preview]')?.getBoundingClientRect();
    flushSync(() => {
      setArt(record);
      setSrc(record.image);
      changePhase('opening');
      setNotice('');
      setFailed(false);
    });
    measure();
    Object.assign(e.pose, tilePose(record.objectId, true, startRect));
    paint();
    frame.current?.focus({ preventScroll: true });
    gsap.to(e.pose, {
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      clip: 1,
      swipe: 0,
      duration: e.reduced ? 0 : 0.65,
      ease: 'power3.inOut',
      onUpdate: paint,
      onComplete: () => {
        if (e.phase === 'opening') changePhase('browsing');
      },
    });
    gsap.to(e.camera, {
      ...currentCamera(),
      duration: e.reduced ? 0 : 0.65,
      ease: 'power3.inOut',
      onUpdate: paint,
    });
    void enhance(record, request);
  }
  function closeViewer() {
    const e = engine.current;
    if (e.phase === 'cluster') return;
    stop();
    points.current.clear();
    ++e.request;
    e.pendingId = 0;
    setLoading(false);
    setFailed(false);
    setNotice('');
    setShowSpots(false);
    changePhase('closing');
    const destinationRect = target.current?.getBoundingClientRect();
    root.current?.setAttribute('data-open', 'false');
    const tile = tilePose(e.art.objectId, false, undefined, destinationRect);
    root.current?.setAttribute('data-open', 'true');
    gsap.to(e.camera, {
      ...previewCamera(e.art),
      duration: e.reduced ? 0 : 0.65,
      ease: 'power3.inOut',
      onUpdate: paint,
    });
    gsap.to(e.pose, {
      ...tile,
      duration: e.reduced ? 0 : 0.65,
      ease: 'power3.inOut',
      onUpdate: paint,
      onComplete: () => {
        changePhase('cluster');
        tiles.current.get(e.art.objectId)?.focus({ preventScroll: true });
      },
    });
  }
  async function browse(direction: number) {
    const e = engine.current;
    if (e.phase === 'cluster' || e.phase === 'closing') return;
    if (spotsFor(e.art).length > 1) {
      selectSpot(e.spotIndex + direction);
      return;
    }
    stop();
    points.current.clear();
    const id = nextArtwork(e.mood, e.pendingId || e.art.objectId, direction);
    e.pendingId = id;
    const record = getArtwork(id),
      request = ++e.request;
    setLoading(true);
    setFailed(false);
    setNotice('');
    gsap.to(e.pose, {
      swipe: 0,
      duration: e.reduced ? 0 : 0.2,
      onUpdate: paint,
    });
    try {
      const detail = await loadDetail(record);
      if (request !== e.request) return;
      gsap.killTweensOf(e.pose);
      // Keep the current image on screen until the replacement has decoded.
      gsap.to(e.pose, {
        swipe: -direction * e.h,
        duration: e.reduced ? 0 : 0.16,
        ease: 'power2.in',
        onUpdate: paint,
        onComplete: () => {
          if (request !== e.request) return;
          e.art = record;
          e.spotIndex = 0;
          setSpotIndex(0);
          setShowSpots(false);
          e.pendingId = 0;
          remembered.current.set(e.mood.id, id);
          Object.assign(e.camera, eyeCamera(record));
          Object.assign(e.pose, {
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0,
            clip: 1,
            swipe: direction * e.h,
          });
          flushSync(() => {
            setArt(record);
            setSrc(detail);
            changePhase('browsing');
            setLoading(false);
          });
          measure();
          gsap.to(e.pose, {
            swipe: 0,
            duration: e.reduced ? 0 : 0.35,
            ease: 'power3.out',
            onUpdate: paint,
          });
          prefetch();
        },
      });
    } catch (error) {
      if (request !== e.request) return;
      e.pendingId = 0;
      retryAction.current = () => {
        void browse(direction);
      };
      setLoading(false);
      setFailed(true);
      setNotice((error as Error).message);
      gsap.to(e.pose, {
        swipe: 0,
        duration: e.reduced ? 0 : 0.35,
        onUpdate: paint,
      });
    }
  }
  function chooseMood(next: MoodDefinition) {
    const e = engine.current;
    if (next.id === e.mood.id) {
      if (e.phase !== 'cluster') closeViewer();
      return;
    }
    if (!next.artworkIds.length) return;
    stop();
    ++e.request;
    points.current.clear();
    e.mood = next;
    e.spotIndex = 0;
    setSpotIndex(0);
    setShowSpots(false);
    e.art = getArtwork(
      remembered.current.get(next.id) ?? next.featuredArtworkId!,
    );
    e.pendingId = 0;
    Object.assign(e.camera, eyeCamera(e.art));
    flushSync(() => {
      setMood(next);
      setArt(e.art);
      setSrc(e.art.thumbnail);
      changePhase('cluster');
      setLoading(false);
      setFailed(false);
      setNotice('');
    });
  }
  function zoom(factor: number, anchor?: Point) {
    const e = engine.current;
    if (e.phase === 'cluster' || e.phase === 'closing') return;
    stop();
    changePhase('exploring');
    setShowSpots(false);
    if (e.pendingId) {
      ++e.request;
      e.pendingId = 0;
      setLoading(false);
    }
    Object.assign(e.pose, {
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      clip: 1,
      swipe: 0,
    });
    const old = { ...e.camera };
    const width = boundCamera(
      { ...old, width: old.width * factor },
      e.art,
    ).width;
    const px = anchor ? anchor.x / e.w - 0.5 : 0,
      py = anchor ? anchor.y / e.h - 0.5 : 0;
    Object.assign(
      e.camera,
      boundCamera(
        {
          width,
          x: old.x + px * (old.width - width),
          y:
            old.y +
            (((py * (old.width - width) * e.art.width) / e.art.height) * 9) /
              16,
        },
        e.art,
      ),
    );
    paint();
  }
  function pointerDown(event: ReactPointerEvent<HTMLElement>) {
    const e = engine.current;
    if (e.phase === 'closing' || event.button !== 0) return;
    stop();
    setShowSpots(false);
    if (e.pendingId) {
      ++e.request;
      e.pendingId = 0;
      setLoading(false);
    }
    if (e.phase === 'opening') {
      Object.assign(e.camera, currentCamera());
      Object.assign(e.pose, {
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        clip: 1,
        swipe: 0,
      });
      changePhase('browsing');
      paint();
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const values = [...points.current.values()];
    const g = gesture.current;
    g.start = values[0];
    g.last = values[0];
    g.time = g.lastTime = event.timeStamp;
    g.velocity = 0;
    g.camera = { ...e.camera };
    if (values.length === 2) {
      g.pinch = Math.hypot(
        values[0].x - values[1].x,
        values[0].y - values[1].y,
      );
      g.pinched = true;
      changePhase('exploring');
    } else g.pinched = false;
  }
  function pointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (!points.current.has(event.pointerId)) return;
    points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const values = [...points.current.values()],
      g = gesture.current,
      e = engine.current;
    if (values.length >= 2) {
      const distance = Math.hypot(
          values[0].x - values[1].x,
          values[0].y - values[1].y,
        ),
        rect = frame.current!.getBoundingClientRect();
      zoom(g.pinch / Math.max(1, distance), {
        x: (values[0].x + values[1].x) / 2 - rect.left,
        y: (values[0].y + values[1].y) / 2 - rect.top,
      });
      g.pinch = distance;
    } else if (!g.pinched) {
      const p = values[0],
        dx = p.x - g.start.x,
        dy = p.y - g.start.y,
        now = event.timeStamp;
      if (e.phase === 'browsing')
        e.pose.swipe = Math.max(-e.h, Math.min(e.h, dy));
      else
        Object.assign(
          e.camera,
          boundCamera(
            {
              ...g.camera,
              x: g.camera.x - (dx / e.w) * g.camera.width,
              y:
                g.camera.y -
                ((dy / e.w) * g.camera.width * e.art.width) / e.art.height,
            },
            e.art,
          ),
        );
      g.velocity = (p.y - g.last.y) / Math.max(1, now - g.lastTime);
      g.last = p;
      g.lastTime = now;
      paint();
    }
  }
  function pointerUp(event: ReactPointerEvent<HTMLElement>) {
    if (!points.current.has(event.pointerId)) return;
    points.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    const e = engine.current,
      g = gesture.current;
    if (points.current.size) return;
    if (e.phase === 'browsing' && !g.pinched) {
      const velocity = event.timeStamp - g.lastTime < 100 ? g.velocity : 0;
      const direction =
        event.type === 'pointercancel'
          ? 0
          : swipeDirection(e.pose.swipe, velocity, e.h);
      if (direction) void browse(direction);
      else
        gsap.to(e.pose, {
          swipe: 0,
          duration: e.reduced ? 0 : 0.35,
          ease: 'power3.out',
          onUpdate: paint,
        });
    }
  }

  useEffect(() => {
    const e = engine.current;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      e.reduced = media.matches;
    };
    update();
    media.addEventListener('change', update);
    const resize = new ResizeObserver(() => {
      if (e.phase === 'opening') {
        stop();
        Object.assign(e.pose, {
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
          clip: 1,
          swipe: 0,
        });
        Object.assign(e.camera, currentCamera());
        changePhase('browsing');
      }
      measure();
    });
    if (stage.current) resize.observe(stage.current);
    const visibility = () => {
      root.current?.setAttribute('data-hidden', String(document.hidden));
      if (document.hidden) {
        gsap.getTweensOf([e.camera, e.pose]).forEach((t) => t.progress(1));
        points.current.clear();
      }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      ++e.request;
      stop();
      resize.disconnect();
      media.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '[data-motion-tile]',
        { y: 24, opacity: 0, rotationY: -12 },
        {
          y: 0,
          opacity: 1,
          rotationY: 0,
          rotation: 0,
          duration: engine.current.reduced ? 0 : 0.5,
          stagger: engine.current.reduced ? 0 : 0.07,
          ease: 'power3.out',
        },
      );
    }, cluster);
    return () => ctx.revert();
  }, [mood.id]);
  useEffect(() => {
    if (phase !== 'browsing' || motionPaused) return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      settleDrift();
      if (!media.matches && !document.hidden) {
        gsap.to(drift.current, {
          amount: 1,
          duration: 7,
          delay: 0.45,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          onUpdate: paint,
        });
      }
    };
    update();
    media.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      settleDrift();
      media.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [phase, art.objectId, spotIndex, motionPaused]);
  useEffect(() => {
    if (!open || !frame.current) return;
    const node = frame.current;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const r = node.getBoundingClientRect();
      zoom(Math.exp(event.deltaY * 0.006), {
        x: event.clientX - r.left,
        y: event.clientY - r.top,
      });
    };
    // Safari trackpads also expose GestureEvent. Ignore its scale when Pointer Events already own a touch pinch.
    let previousScale = 1;
    const safariGesture = (event: Event) => {
      event.preventDefault();
      const gesture = event as Event & {
        scale: number;
        clientX: number;
        clientY: number;
      };
      if (event.type === 'gesturestart') {
        previousScale = gesture.scale || 1;
        return;
      }
      if (event.type === 'gesturechange' && points.current.size < 2) {
        const rect = node.getBoundingClientRect();
        zoom(previousScale / (gesture.scale || 1), {
          x: gesture.clientX - rect.left,
          y: gesture.clientY - rect.top,
        });
      }
      previousScale = gesture.scale || 1;
    };
    node.addEventListener('wheel', wheel, { passive: false });
    node.addEventListener('gesturestart', safariGesture, { passive: false });
    node.addEventListener('gesturechange', safariGesture, { passive: false });
    return () => {
      node.removeEventListener('wheel', wheel);
      node.removeEventListener('gesturestart', safariGesture);
      node.removeEventListener('gesturechange', safariGesture);
    };
  }, [open]);

  return (
    <main
      ref={root}
      className={s.root}
      data-open={open}
      data-motion-paused={motionPaused}
      onKeyDown={(event) => {
        if (!open) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          closeViewer();
        }
        if ((event.target as HTMLElement).closest('[role="radiogroup"]'))
          return;
        if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
          event.preventDefault();
          void browse(1);
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
          event.preventDefault();
          void browse(-1);
        }
      }}
    >
      <header className={s.header}>
        <a href="/" className={s.brand}>
          museum mood
        </a>
      </header>
      <section className={s.surface} aria-label="painting explorer">
        <p className={s.kicker}>the art of</p>
        <h1 className={s.heading}>
          {mood.id}.
        </h1>
        <p className={s.dockLabel}>how are we feeling?</p>
        <MoodDock moods={moods} selected={mood.id} onSelect={chooseMood} />
        <div className={s.stage} ref={stage}>
          <div className={s.stageLabel} aria-hidden="true">
            <span>old art. current feelings.</span>
            <span>
              choose a face below
            </span>
          </div>
          <div
            className={s.cluster}
            ref={cluster}
            data-count={mood.artworkIds.length}
            aria-hidden={open}
            style={{
              opacity: open ? 0 : 1,
              pointerEvents: open ? 'none' : 'auto',
            }}
          >
            <span className={s.alternateLabel} aria-hidden="true">other ways to say it</span>
            {mood.artworkIds.map((id) => {
              const record = getArtwork(id);
              const crop = previewCamera(record);
              return (
                <button
                  data-motion-tile
                  key={id}
                  className={s.tile}
                  style={{ '--art-ratio': record.width / record.height } as CSSProperties}
                  ref={(el) => {
                    if (el) tiles.current.set(id, el);
                    else tiles.current.delete(id);
                  }}
                  tabIndex={open ? -1 : 0}
                  onClick={() => openArt(record)}
                  aria-label={`explore ${record.title} by ${record.artist}`}
                  title={`${record.title} — ${record.artist}`}
                >
                  <span className={s.thumbnailMask} data-motion-preview>
                  <img
                    src={record.image}
                    decoding="async"
                    width={record.width}
                    height={record.height}
                    alt={record.alt}
                    style={{ width: `${100 / crop.width}%`, left: `${50 - crop.x * 100 / crop.width}%`, top: `${50 - crop.y * record.height / record.width * 100 / crop.width}%` }}
                  />
                  <span className={s.hoverTitle} aria-hidden="true">{record.title}</span>
                  </span>
                  <span className={s.galleryLabel} aria-hidden="true">
                    <strong>{record.title}</strong>
                    <span>{record.artist}, {record.date}</span>
                  </span>
                  <span className={s.openHint} aria-hidden="true">meet the look ↗</span>
                  <span className={s.tileCaption} aria-hidden="true">
                    <span className={s.artReaction}>{record.objectId === 437397 ? 'be serious.' : spotsFor(record)[0]?.label}</span>
                    <span className={s.artByline}>{record.objectId === 437397 ? 'rembrandt' : record.artist.toLowerCase()}</span>
                    <span className={s.artMeta}>{record.title.toLowerCase()} · {record.date.toLowerCase()}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className={s.target} ref={target} />
          {open && (
            <div
              className={s.viewer}
              style={{
                overflow:
                  phase === 'opening' || phase === 'closing'
                    ? 'visible'
                    : 'hidden',
              }}
            >
              <section
                ref={frame}
                className={s.frame}
                tabIndex={0}
                aria-label={`${art.title}. ${expression.label}. ${phase === 'exploring' ? 'drag to pan' : 'swipe up or down for another reaction'}. pinch or use controls to zoom.`}
                onPointerDown={pointerDown}
                onPointerMove={pointerMove}
                onPointerUp={pointerUp}
                onPointerCancel={pointerUp}
              >
                <div className={s.mask} ref={mask}>
                  <img
                    ref={painting}
                    className={s.painting}
                    src={src}
                    alt={art.alt}
                    draggable={false}
                    onError={() => {
                      retryAction.current = () => {
                        cache.current.delete(engine.current.art.objectId);
                        void enhance(
                          engine.current.art,
                          ++engine.current.request,
                        );
                      };
                      setFailed(true);
                      setNotice('couldn’t load this painting. try again?');
                    }}
                  />
                </div>
                {showSpots &&
                  art.width > art.height &&
                  expressions.length > 1 &&
                  expressions
                    .filter((spot) => !spot.full)
                    .map((spot, i) => (
                      <button
                        key={spot.id}
                        className={s.marker}
                        ref={(el) => {
                          if (el) markers.current.set(spot.id, el);
                          else markers.current.delete(spot.id);
                        }}
                        aria-label={`zoom to ${spot.label}`}
                        title={spot.label}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => selectSpot(i)}
                      >
                        {i + 1}
                      </button>
                    ))}
              </section>
            </div>
          )}
        </div>
        <div className={s.below}>
          {open && (
            <>
              <div className={s.controls} aria-label="painting controls">
                <button
                  className={s.control}
                  onClick={() => void browse(-1)}
                  aria-label={
                    expressions.length > 1
                      ? 'previous expression'
                      : 'previous painting'
                  }
                >
                  <ArrowDown size={17} />
                </button>
                <span className={s.hint} aria-live="polite">
                  {expressions.length > 1
                    ? spotIndex + 1
                    : mood.artworkIds.indexOf(art.objectId) + 1}{' '}
                  /{' '}
                  {expressions.length > 1
                    ? expressions.length
                    : mood.artworkIds.length}
                </span>
                <button
                  className={s.control}
                  onClick={() => void browse(1)}
                  aria-label={
                    expressions.length > 1 ? 'next expression' : 'next painting'
                  }
                >
                  <ArrowUp size={17} />
                </button>
                <span className={s.divider} />
                <button
                  className={s.control}
                  onClick={() =>
                    expression.full
                      ? selectSpot(0)
                      : animateCamera(currentCamera(), 'browsing')
                  }
                  aria-pressed={phase === 'browsing' && !expression.full}
                >
                  eyes
                </button>
                <button
                  className={s.control}
                  onClick={() => {
                    animateCamera(fullCamera(engine.current.art), 'exploring');
                    setShowSpots(true);
                  }}
                >
                  full painting
                </button>
                <button
                  className={s.control}
                  onClick={() => zoom(1.25)}
                  aria-label="zoom out"
                >
                  <Minus size={16} />
                </button>
                <button
                  className={s.control}
                  onClick={() => zoom(0.8)}
                  aria-label="zoom in"
                >
                  <Plus size={16} />
                </button>
                <button
                  className={s.control}
                  onClick={closeViewer}
                  aria-label="close painting"
                >
                  <X size={17} />
                </button>
              </div>
              {expressions.length > 1 ? (
                <div
                  className={s.expressions}
                  aria-label="choose an expression"
                >
                  {expressions.map((spot, i) => (
                    <button
                      key={spot.id}
                      className={s.expression}
                      aria-pressed={spotIndex === i}
                      onClick={() => selectSpot(i)}
                    >
                      <span aria-hidden="true">{i + 1}</span>
                      {spot.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className={s.reaction}>{expression.label}</p>
              )}
              <p className={s.credit}>
                <a href={art.source} target="_blank" rel="noreferrer">
                  {art.title}
                </a>
                <br />
                {art.artist}, {art.date}
              </p>
            </>
          )}
          <output className={s.status} aria-live="polite">
            {notice || (loading ? 'getting a closer look…' : '')}
            {failed && (
              <button
                className={s.control}
                onClick={() => retryAction.current()}
              >
                <RotateCcw size={14} />
                try again
              </button>
            )}
          </output>
        </div>
      </section>
      <footer className={s.foot}>
        <span className={s.signature}>old art. current feelings. <a href="https://x.com/jezamancenido" target="_blank" rel="noreferrer">@jezamancenido ↗</a></span>
        <button
          className={s.motionToggle}
          onClick={() => setMotionPaused(!motionPaused)}
          aria-pressed={motionPaused}
          aria-label={
            motionPaused ? 'resume ambient motion' : 'pause ambient motion'
          }
        >
          {motionPaused ? <Play size={13} /> : <Pause size={13} />}{' '}
          {motionPaused ? 'motion paused' : 'motion on'}
        </button>
        <a
          href={
            open ? art.source : 'https://www.metmuseum.org/hubs/open-access'
          }
          target="_blank"
          rel="noreferrer"
        >
          the met · public domain ↗
        </a>
      </footer>
    </main>
  );
}
