import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Calculator, History, Settings, Database } from 'lucide-react';

// Constantes pour les types de disques
const DISK_TYPES = {
  '3390': { name: 'IBM 3390', tracksPerCylinder: 15, bytesPerTrack: 56664 },
  '3380': { name: 'IBM 3380', tracksPerCylinder: 15, bytesPerTrack: 47476 },
  '3350': { name: 'IBM 3350', tracksPerCylinder: 30, bytesPerTrack: 19254 }
};

// Service de conversion
class ConversionService {
  static cylindersToTracks(cylinders, diskType) {
    return cylinders * DISK_TYPES[diskType].tracksPerCylinder;
  }

  static tracksToMegabytes(tracks, diskType) {
    const bytes = tracks * DISK_TYPES[diskType].bytesPerTrack;
    return bytes / (1024 * 1024);
  }

  static megabytesToTracks(megabytes, diskType) {
    const bytes = megabytes * 1024 * 1024;
    return bytes / DISK_TYPES[diskType].bytesPerTrack;
  }

  static tracksToCylinders(tracks, diskType) {
    return tracks / DISK_TYPES[diskType].tracksPerCylinder;
  }

  static convert(value, fromUnit, toUnit, diskType) {
    if (!value || value <= 0) return 0;

    let tracks = 0;

    switch (fromUnit) {
      case 'CYL':
        tracks = this.cylindersToTracks(value, diskType);
        break;
      case 'TRKS':
        tracks = value;
        break;
      case 'MO':
        tracks = this.megabytesToTracks(value, diskType);
        break;
      default:
        return 0;
    }

    switch (toUnit) {
      case 'CYL':
        return this.tracksToCylinders(tracks, diskType);
      case 'TRKS':
        return tracks;
      case 'MO':
        return this.tracksToMegabytes(tracks, diskType);
      default:
        return 0;
    }
  }
}

// Service ZFS Calculator
class ZfsCalculatorService {
  static calculateUsagePercentage(usedSpace, totalSpace) {
    if (!totalSpace || totalSpace <= 0) return 0;
    return (usedSpace / totalSpace) * 100;
  }

  static calculateFreeSpace(totalSpace, usedSpace) {
    return Math.max(0, totalSpace - usedSpace);
  }

  static convertUnit(value, fromUnit, toUnit) {
    if (fromUnit === toUnit) return value;
    if (fromUnit === 'bytes' && toUnit === 'mb') {
      return value / (1024 * 1024);
    }
    if (fromUnit === 'mb' && toUnit === 'bytes') {
      return value * 1024 * 1024;
    }
    return value;
  }

  static simulateExpansion(currentZfs, additionalSpace, unit, percentToAdd = 0) {
    let additionalInBytes = this.convertUnit(additionalSpace, unit, 'bytes');

    // Si un pourcentage est fourni, on l'ajoute à l'espace additionnel
    if (percentToAdd > 0) {
      const percentAdditional = (currentZfs.totalSpace * percentToAdd) / 100;
      additionalInBytes += percentAdditional;
    }

    const newTotalSpace = currentZfs.totalSpace + additionalInBytes;
    const newPercentUsed = this.calculateUsagePercentage(currentZfs.usedSpace, newTotalSpace);
    const newFreeSpace = this.calculateFreeSpace(newTotalSpace, currentZfs.usedSpace);

    return {
      projectedTotalSpace: newTotalSpace,
      projectedPercentUsed: newPercentUsed,
      projectedFreeSpace: newFreeSpace,
      additionalSpace: additionalInBytes
    };
  }
}

// Ajout du champ pourcentage dans le panneau de simulation
const SimulationPanel = ({ onSimulate, simulation }) => {
  const [additionalSpace, setAdditionalSpace] = useState('');
  const [percentToAdd, setPercentToAdd] = useState('');
  const [unit, setUnit] = useState('mb');

  const handleSimulate = () => {
    const space = parseFloat(additionalSpace) || 0;
    const percent = parseFloat(percentToAdd) || 0;
    if (space > 0 || percent > 0) {
      onSimulate(space, unit, percent);
    }
  };

  const formatValue = (value) => {
    if (unit === 'mb') return (value / (1024 * 1024)).toFixed(2);
    return value.toFixed(0);
  };

  return (
    <div className="card">
      <h3 className="results-title">Simulation d'expansion</h3>

      <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
        <input
          type="number"
          value={additionalSpace}
          onChange={(e) => setAdditionalSpace(e.target.value)}
          placeholder="Espace à ajouter"
          className="form-input"
          style={{ flex: '1', minWidth: '200px' }}
        />
        <input
          type="number"
          value={percentToAdd}
          onChange={(e) => setPercentToAdd(e.target.value)}
          placeholder="% à ajouter"
          className="form-input"
          style={{ width: '100px' }}
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="form-input"
          style={{ width: 'auto' }}
        >
          <option value="mb">MB</option>
          <option value="bytes">Bytes</option>
        </select>
        <button
          onClick={handleSimulate}
          className="btn btn-primary"
        >
          Simuler
        </button>
      </div>

      {simulation && (
        <div style={{ paddingTop: '0.75rem', borderTop: '1px solid #374151' }}>
          <h4 className="results-label" style={{ marginBottom: '0.5rem', fontWeight: '500' }}>
            Résultats de la simulation:
          </h4>
          <div className="results-item">
            <span className="results-label">Nouveau total:</span>
            <span className="results-value">
              {formatValue(simulation.projectedTotalSpace)} {unit.toUpperCase()}
            </span>
          </div>
          <div className="results-item">
            <span className="results-label">Nouvelle utilisation:</span>
            <span className="results-value">
              {simulation.projectedPercentUsed.toFixed(1)}%
            </span>
          </div>
          <div className="results-item">
            <span className="results-label">Nouvel espace libre:</span>
            <span className="results-value">
              {formatValue(simulation.projectedFreeSpace)} {unit.toUpperCase()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
