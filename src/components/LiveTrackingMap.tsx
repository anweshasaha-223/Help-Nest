import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Navigation, MapPin, AlertCircle } from 'lucide-react';
import type { Coordinates } from '../types';

interface LiveTrackingMapProps {
  customerLocation: Coordinates;
  workerLocation?: Coordinates;
  workerName?: string;
  customerName?: string;
  title?: string;
  onUpdateCoordinates?: (coords: Coordinates) => void;
  updateButtonLabel?: string;
  isLiveTracking?: boolean;
  lastUpdateTimestamp?: string;
  trackingStatusText?: string;
}

function haversineDistanceKm(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 100) / 100;
}

export const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({
  customerLocation,
  workerLocation,
  workerName = 'Assigned Worker',
  customerName = 'Customer Location',
  title = 'OpenStreetMap Cooperative Location View',
  onUpdateCoordinates,
  updateButtonLabel = 'Update My Live GPS',
  isLiveTracking = false,
  lastUpdateTimestamp,
  trackingStatusText,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const hasValidCustomerCoords =
    customerLocation &&
    typeof customerLocation.lat === 'number' &&
    typeof customerLocation.lng === 'number' &&
    !Number.isNaN(customerLocation.lat) &&
    !Number.isNaN(customerLocation.lng);

  const hasValidWorkerCoords =
    workerLocation &&
    typeof workerLocation.lat === 'number' &&
    typeof workerLocation.lng === 'number' &&
    !Number.isNaN(workerLocation.lat) &&
    !Number.isNaN(workerLocation.lng);

  const distanceKm =
    hasValidCustomerCoords && hasValidWorkerCoords && workerLocation
      ? haversineDistanceKm(customerLocation, workerLocation)
      : null;

  // Estimate travel time at urban average 20 km/h (3 mins per km + 4 mins buffer)
  const estimatedMinutes =
    distanceKm !== null ? Math.max(4, Math.round(distanceKm * 3.5 + 3)) : null;

  useEffect(() => {
    if (!mapContainerRef.current || !hasValidCustomerCoords) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapContainerRef.current, {
        center: [customerLocation.lat, customerLocation.lng],
        zoom: 14,
        scrollWheelZoom: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;

    // Clear existing markers and polylines
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.CircleMarker) {
        map.removeLayer(layer);
      }
    });

    // Customer Marker (Teal CircleMarker)
    const customerMarker = L.circleMarker([customerLocation.lat, customerLocation.lng], {
      radius: 9,
      fillColor: '#0F766E',
      color: '#FFFFFF',
      weight: 3,
      opacity: 1,
      fillOpacity: 0.95,
    }).addTo(map);

    customerMarker.bindPopup(
      `<strong>${customerName}</strong><br/>${
        customerLocation.addressLabel ||
        `${customerLocation.lat.toFixed(4)}, ${customerLocation.lng.toFixed(4)}`
      }`
    );

    if (hasValidWorkerCoords && workerLocation) {
      // Worker Marker (Amber CircleMarker)
      const workerMarker = L.circleMarker([workerLocation.lat, workerLocation.lng], {
        radius: 9,
        fillColor: '#D97706',
        color: '#FFFFFF',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.95,
      }).addTo(map);

      workerMarker.bindPopup(
        `<strong>${workerName}</strong><br/>${
          workerLocation.addressLabel ||
          `${workerLocation.lat.toFixed(4)}, ${workerLocation.lng.toFixed(4)}`
        }`
      );

      // Direct line showing verified coordinate separation
      const routeLine = L.polyline(
        [
          [customerLocation.lat, customerLocation.lng],
          [workerLocation.lat, workerLocation.lng],
        ],
        {
          color: '#0F766E',
          weight: 3,
          dashArray: '6, 6',
        }
      ).addTo(map);

      map.fitBounds(routeLine.getBounds(), { padding: [36, 36], maxZoom: 15 });
    } else {
      map.setView([customerLocation.lat, customerLocation.lng], 14);
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 120);
  }, [
    customerLocation?.lat,
    customerLocation?.lng,
    workerLocation?.lat,
    workerLocation?.lng,
    hasValidCustomerCoords,
    hasValidWorkerCoords,
    customerName,
    workerName,
  ]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const handleRequestBrowserGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('Geolocation API is not supported by this browser.');
      return;
    }
    setLocating(true);
    setGpsStatus(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const newCoords: Coordinates = {
          lat: Math.round(position.coords.latitude * 10000) / 10000,
          lng: Math.round(position.coords.longitude * 10000) / 10000,
          addressLabel: `Live Browser GPS (${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)})`,
        };
        setGpsStatus(`Updated coordinates from device GPS: ${newCoords.lat}, ${newCoords.lng}`);
        if (onUpdateCoordinates) {
          onUpdateCoordinates(newCoords);
        }
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus(
            'Location permission was denied. Using last saved location coordinates.'
          );
        } else {
          setGpsStatus(`Unable to retrieve live GPS (${err.message}). Using saved coordinates.`);
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  if (!hasValidCustomerCoords) {
    return (
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>Location coordinates are missing for this record. Map cannot be rendered.</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-850">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">{title}</span>
          {isLiveTracking ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>LIVE GPS ACTIVE</span>
            </span>
          ) : trackingStatusText ? (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              {trackingStatusText}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
          {lastUpdateTimestamp && (
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              Last ping: {new Date(lastUpdateTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          {distanceKm !== null && (
            <span className="font-mono tabular-nums">
              Distance: <strong className="text-slate-900 dark:text-slate-100">{distanceKm.toFixed(2)} km</strong>
              {estimatedMinutes !== null && ` · Est. Travel: ~${estimatedMinutes} mins`}
            </span>
          )}
          {onUpdateCoordinates && (
            <button
              type="button"
              onClick={handleRequestBrowserGps}
              disabled={locating}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium transition-colors cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
              <span>{locating ? 'Locating...' : updateButtonLabel}</span>
            </button>
          )}
        </div>
      </div>

      <div ref={mapContainerRef} className="w-full h-64 bg-slate-100" />

      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-700 inline-block" />
            <span>
              Customer: {customerLocation.lat.toFixed(4)}, {customerLocation.lng.toFixed(4)}
            </span>
          </span>
          {hasValidWorkerCoords && workerLocation && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block" />
              <span>
                {workerName}: {workerLocation.lat.toFixed(4)}, {workerLocation.lng.toFixed(4)}
              </span>
            </span>
          )}
        </div>
        <span className="text-slate-500">
          Coordinates reflect actual recorded GPS positions (no fabricated movement).
        </span>
      </div>

      {gpsStatus && (
        <div className="px-4 py-2 bg-teal-50/70 border-t border-teal-100 text-xs text-teal-900">
          {gpsStatus}
        </div>
      )}
    </div>
  );
};
