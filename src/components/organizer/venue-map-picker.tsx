'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { LngLatBounds, Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export type VenuePoint = { latitude: number; longitude: number };

type MapPlace = VenuePoint & { name: string };

function poiLayers(map: MapLibreMap) {
  return map.getStyle()?.layers.flatMap(layer => layer.id.startsWith('poi_') && 'source' in layer
    ? [{ id: layer.id, source: layer.source, sourceLayer: 'source-layer' in layer ? layer['source-layer'] : undefined }]
    : []) ?? [];
}

function mapPlaces(map: MapLibreMap, query: string, bounds: LngLatBounds): MapPlace[] {
  const terms = query.trim().toLocaleLowerCase('id').split(/\s+/);
  if (terms.join('').length < 2) return [];
  const layers = poiLayers(map);
  const sources = new Map(layers.map(layer => [`${layer.source}:${layer.sourceLayer ?? ''}`, layer]));
  const places = new Map<string, MapPlace>();
  for (const { source, sourceLayer } of sources.values()) {
    for (const feature of map.querySourceFeatures(source, { sourceLayer })) {
      if (feature.geometry.type !== 'Point') continue;
      const name = feature.properties?.name ?? feature.properties?.name_en;
      if (typeof name !== 'string' || !terms.every(term => name.toLocaleLowerCase('id').includes(term))) continue;
      const [longitude, latitude] = feature.geometry.coordinates;
      if (!bounds.contains([longitude, latitude])) continue;
      const key = `${name}:${latitude.toFixed(5)}:${longitude.toFixed(5)}`;
      places.set(key, { name: name.slice(0, 200), latitude, longitude });
      if (places.size >= 6) return [...places.values()];
    }
  }
  return [...places.values()];
}

const detailZoom = 14;
const malang: VenuePoint = { latitude: -7.98, longitude: 112.63 };

function deviceLocation(): Promise<VenuePoint> {
  if (!navigator.geolocation) return Promise.resolve(malang);

  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude, longitude } }) => resolve({ latitude, longitude }),
      () => resolve(malang),
      { timeout: 5000, maximumAge: 60_000 },
    );
  });
}

export function VenueMapPicker({ center, query, onPointChange }: { center: VenuePoint | null; query: string; onPointChange: (point: VenuePoint, placeName?: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ map: MapLibreMap; marker: Marker } | null>(null);
  const searchBounds = useRef<LngLatBounds | null>(null);
  const [results, setResults] = useState<{ query: string; matches: MapPlace[] } | null>(null);
  const [status, setStatus] = useState<'locating' | 'loading' | 'ready' | 'error'>(center ? 'loading' : 'locating');
  const latitude = center?.latitude;
  const longitude = center?.longitude;
  function reportPoint(marker: Marker, placeName?: string) {
    const point = marker.getLngLat().wrap();
    onPointChange({ latitude: Number(point.lat.toFixed(6)), longitude: Number(point.lng.toFixed(6)) }, placeName);
  }

  const updatePoint = useEffectEvent(reportPoint);
  const refreshMatches = useEffectEvent((map: MapLibreMap) => {
    if (query.length >= 2) setResults({ query, matches: mapPlaces(map, query, searchBounds.current ?? map.getBounds()) });
  });

  function choosePlace(place: MapPlace) {
    const current = mapRef.current;
    if (!current) return;
    searchBounds.current = null;
    current.marker.setLngLat([place.longitude, place.latitude]);
    current.map.jumpTo({ center: [place.longitude, place.latitude] });
    reportPoint(current.marker, place.name);
  }

  useEffect(() => {
    let active = true;
    let map: MapLibreMap | undefined;
    let marker: Marker | undefined;
    const initialPoint = latitude !== undefined && longitude !== undefined
      ? { latitude, longitude }
      : deviceLocation();
    void Promise.all([import('maplibre-gl'), initialPoint]).then(([{ Map, Marker, NavigationControl, setWorkerUrl }, point]) => {
      if (!active || !container.current) return;
      setStatus('loading');
      setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString());
      const instance = new Map({
        container: container.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [point.longitude, point.latitude],
        zoom: latitude === undefined ? 13 : 15,
        cooperativeGestures: true,
        dragRotate: false,
        pitchWithRotate: false,
        attributionControl: { compact: true },
      });
      map = instance;
      const pin = new Marker({
        draggable: true,
        color: '#005bab',
        className: 'grid min-h-11 min-w-11 place-items-center touch-none rounded-md focus-visible:outline-2 focus-visible:outline-[#005bab]',
      }).setLngLat([point.longitude, point.latitude]);
      marker = pin;
      const pinElement = pin.getElement();
      pinElement.setAttribute('aria-label', 'Pin titik kumpul');
      pin.on('dragend', () => updatePoint(pin));
      pin.on('click', () => updatePoint(pin));
      pinElement.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          updatePoint(pin);
        }
      });
      instance.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      instance.on('load', () => {
        pin.addTo(instance);
        mapRef.current = { map: instance, marker: pin };
        setStatus('ready');
      });
      instance.on('idle', () => refreshMatches(instance));
      instance.on('movestart', event => {
        if (event.originalEvent) searchBounds.current = null;
      });
      instance.on('error', () => {
        if (!instance.isStyleLoaded()) setStatus('error');
      });
      instance.on('click', event => {
        if (!pinElement.isConnected || pinElement.contains(event.originalEvent.target as Node)) return;
        const layers = poiLayers(instance).map(layer => layer.id);
        const label = layers.length
          ? instance.queryRenderedFeatures(event.point, { layers }).find(feature =>
            feature.geometry.type === 'Point' && typeof (feature.properties?.name ?? feature.properties?.name_en) === 'string')
          : undefined;
        if (label?.geometry.type === 'Point') {
          const [lng, lat] = label.geometry.coordinates;
          pin.setLngLat([lng, lat]);
          updatePoint(pin, (label.properties.name ?? label.properties.name_en).slice(0, 200));
        } else {
          pin.setLngLat(event.lngLat);
          updatePoint(pin);
        }
      });
    }).catch(() => { if (active) setStatus('error'); });

    return () => {
      active = false;
      mapRef.current = null;
      searchBounds.current = null;
      marker?.remove();
      map?.remove();
    };
  }, [latitude, longitude]);

  useEffect(() => {
    const map = mapRef.current?.map;
    if (status !== 'ready' || !map) return;
    if (query.length < 2) {
      searchBounds.current = null;
      return;
    }
    if (map.getZoom() < detailZoom) {
      searchBounds.current = map.getBounds();
      map.jumpTo({ zoom: detailZoom });
    } else {
      map.triggerRepaint();
    }
  }, [query, status]);

  const matches = results?.query === query ? results.matches : null;
  return <div className="grid gap-2">
    {status === 'ready' && query.length >= 2 && <div className="grid gap-2">
      <p className="text-sm font-medium">Hasil di area peta</p>
      {matches?.length ? (
        <ul className="divide-y rounded-lg border bg-card">
          {matches.map(place => <li key={`${place.name}:${place.latitude}:${place.longitude}`}>
            <button type="button" className="min-h-11 w-full break-words rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              onClick={() => choosePlace(place)}>{place.name}</button>
          </li>)}
        </ul>
      ) : <p role="status" className="text-sm text-muted-foreground">
        {matches ? 'Belum ada hasil di area ini. Geser peta ke sekitar tempat yang dicari.' : 'Mencari tempat di area peta…'}
      </p>}
    </div>}
    <p className="text-sm text-muted-foreground">Pilih nama tempat di peta atau geser pin untuk mengatur titik kumpul.</p>
    <div className="relative overflow-hidden rounded-lg border bg-muted">
      <div ref={container} aria-label="Peta titik kumpul" className="h-60 w-full sm:h-72" />
      {status !== 'ready' && <p role="status" className="pointer-events-none absolute inset-0 grid place-items-center bg-muted/90 px-4 text-center text-sm text-muted-foreground">
        {status === 'locating' ? 'Mencari lokasi perangkat…' :
          status === 'loading' ? 'Memuat peta…' : 'Peta belum bisa dimuat. Isi koordinat secara manual.'}
      </p>}
    </div>
  </div>;
}
