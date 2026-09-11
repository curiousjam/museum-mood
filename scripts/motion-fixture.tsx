// Development-only fixture, bundled into ignored outputs/. Never part of a route.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import MotionGallery from '../app/motion/motion-gallery';
import { moodDefinitions, motionArtworks } from '../lib/motion';

if (new URLSearchParams(location.search).has('reduced')) {
  const native = window.matchMedia.bind(window);
  window.matchMedia = (query: string) => {
    const result = native(query);
    return query.includes('prefers-reduced-motion')
      ? new Proxy(result, {
          get(target, key) {
            if (key === 'matches') return true;
            const value = Reflect.get(target, key, target);
            return typeof value === 'function' ? value.bind(target) : value;
          },
        })
      : result;
  };
}
const allMoods = moodDefinitions.map((m) => ({
  ...m,
  artworkIds: motionArtworks.slice(0,3).map((a) => a.objectId),
  featuredArtworkId: motionArtworks[0].objectId,
}));
function Fixture() {
  const [large, setLarge] = useState(false),
    [missing, setMissing] = useState(false);
  return (
    <>
      <nav
        style={{
          padding: 12,
          display: 'flex',
          gap: 20,
          background: '#edf3ff',
          fontSize: 14,
        }}
        aria-label="test fixture controls"
      >
        <label>
          <input
            type="checkbox"
            checked={large}
            onChange={(e) => {
              setLarge(e.target.checked);
              document.documentElement.style.fontSize = e.target.checked
                ? '200%'
                : '100%';
            }}
          />
          200% text
        </label>
        <label>
          <input
            type="checkbox"
            checked={missing}
            onChange={(e) => setMissing(e.target.checked)}
          />
          missing detail images
        </label>
        <a href="?reduced">reduced motion fixture</a>
      </nav>
      <MotionGallery
        key={String(missing)}
        moods={allMoods}
        records={
          missing
            ? motionArtworks.map((a) => ({
                ...a,
                image: '/art/motion/intentionally-missing.jpg',
              }))
            : motionArtworks
        }
      />
    </>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
