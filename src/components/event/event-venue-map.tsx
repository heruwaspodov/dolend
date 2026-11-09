'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export function EventVenueMap({ latitude, longitude }: { latitude: number; longitude: number }) {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    let map: MapLibreMap | undefined;

    void import('maplibre-gl').then(({ Map, Marker, setWorkerUrl }) => {
      if (!active || !container.current) return;
      setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString());
      const center: [number, number] = [longitude, latitude];
      const instance = new Map({
        container: container.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center,
        zoom: 16,
        interactive: false,
        attributionControl: { compact: true },
      });
      map = instance;
      new Marker({ color: '#005bab' }).setLngLat(center).addTo(instance);
      instance.on('load', () => setStatus('ready'));
      instance.on('error', () => {
        if (!instance.isStyleLoaded()) setStatus('error');
      });
    }).catch(() => {
      if (active) setStatus('error');
    });

    return () => {
      active = false;
      map?.remove();
    };
  }, [latitude, longitude]);

  return <div role="region" aria-label="Peta lokasi event" aria-busy={status === 'loading'} className="relative mt-3 h-44 overflow-hidden rounded-xl border border-[#e6e3df] bg-[#f6f5f4] sm:h-56">
    <div ref={container} inert={status !== 'ready'} className="h-full w-full" />
    {status !== 'ready' && <p role="status" className="pointer-events-none absolute inset-0 grid place-items-center bg-[#f6f5f4] px-4 text-center text-sm text-[#615d59]">
      {status === 'loading' ? 'Memuat peta lokasi…' : 'Peta belum bisa dimuat. Gunakan tautan Google Maps di bawah.'}
    </p>}
  </div>;
}
