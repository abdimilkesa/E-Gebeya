import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '@marketplace/contracts';
import { AdvancedMarker, Map as GoogleMap, Pin, useMap } from '@vis.gl/react-google-maps';
import { Crosshair, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { GOOGLE_MAPS_MAP_ID } from '../../config';
import { Button } from '../ui/Button';
import { MapsProvider } from './MapsProvider';

const PAIR = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

/** Parses "7.6742, 36.8346" (the format Google Maps copies) into a coordinate pair. */
export function parseCoordinatePair(text: string): { latitude: string; longitude: string } | null {
  const match = PAIR.exec(text);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { latitude: lat.toFixed(6), longitude: lng.toFixed(6) };
}

function toPosition(latitude: string, longitude: string): google.maps.LatLngLiteral | null {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (latitude.trim() === '' || longitude.trim() === '' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/**
 * Map for placing a shop at its real location: click the map or drag the pin. The typed
 * latitude/longitude fields stay the source of truth, so this also works without a Maps key.
 */
export function LocationPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: string;
  longitude: string;
  onChange: (latitude: string, longitude: string) => void;
}) {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const position = toPosition(latitude, longitude);
  const pick = (lat: number, lng: number) => onChange(lat.toFixed(6), lng.toFixed(6));

  const useDeviceLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('This browser cannot share its location.');
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setLocating(false);
        pick(result.coords.latitude, result.coords.longitude);
      },
      (error) => {
        setLocating(false);
        setGeoError(error.code === error.PERMISSION_DENIED ? 'Location permission was denied.' : 'Could not read your location.');
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  return (
    <div className="space-y-3">
      <div className="h-72 overflow-hidden rounded-xl border border-ink-200">
        <MapsProvider className="size-full">
          <PickerMap position={position} onPick={pick} />
        </MapsProvider>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button
          variant="secondary"
          size="sm"
          onClick={useDeviceLocation}
          loading={locating}
          icon={<Crosshair className="size-4" />}
        >
          Use my current location
        </Button>
        {position ? (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${position.lat},${position.lng}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-ink-700 hover:text-ink-950"
          >
            <ExternalLink className="size-3.5" /> Check in Google Maps
          </a>
        ) : null}
        {geoError ? <span className="text-red-600">{geoError}</span> : null}
      </div>
      <p className="text-sm text-ink-500">
        Click the map or drag the pin to the shop entrance. You can also paste coordinates copied from Google Maps into the
        latitude field.
      </p>
    </div>
  );
}

function PickerMap({
  position,
  onPick,
}: {
  position: google.maps.LatLngLiteral | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  const lat = position?.lat;
  const lng = position?.lng;

  useEffect(() => {
    if (!map || lat === undefined || lng === undefined) return;
    map.panTo({ lat, lng });
  }, [map, lat, lng]);

  return (
    <GoogleMap
      mapId={GOOGLE_MAPS_MAP_ID}
      defaultCenter={position ?? DEFAULT_MAP_CENTER}
      defaultZoom={position ? 17 : DEFAULT_MAP_ZOOM}
      gestureHandling="greedy"
      clickableIcons={false}
      streetViewControl={false}
      mapTypeControl={false}
      fullscreenControl={false}
      onClick={(event) => {
        const point = event.detail.latLng;
        if (point) onPick(point.lat, point.lng);
      }}
      className="size-full"
    >
      {position ? (
        <AdvancedMarker
          position={position}
          draggable
          title="Shop location"
          onDragEnd={(event) => {
            const point = event.latLng;
            if (point) onPick(point.lat(), point.lng());
          }}
        >
          <Pin background="#f0b429" borderColor="#8f5b0b" glyphColor="#0b0b0f" scale={1.2} />
        </AdvancedMarker>
      ) : null}
    </GoogleMap>
  );
}
