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

// Service ZFS Calculator - MODIFIÉ pour supporter les pourcentages
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

  static simulateExpansion(currentZfs, spaceChange, unit) {
    let spaceChangeInBytes;
    
    // NOUVEAU : Gestion des pourcentages (retirer de l'espace)
    if (unit === 'percentage') {
      spaceChangeInBytes = -(currentZfs.freeSpace * spaceChange) / 100; // Négatif pour retirer
    } else {
      spaceChangeInBytes = this.convertUnit(spaceChange, unit, 'bytes');
    }
    
    const newFreeSpace = currentZfs.freeSpace + spaceChangeInBytes;
    const newUsedSpace = currentZfs.totalSpace - newFreeSpace;
    const newPercentUsed = this.calculateUsagePercentage(newUsedSpace, currentZfs.totalSpace);

    return {
      projectedTotalSpace: currentZfs.totalSpace,
      projectedUsedSpace: newUsedSpace,
      projectedFreeSpace: newFreeSpace,
      projectedPercentUsed: newPercentUsed,
      spaceChange: spaceChangeInBytes
    };
  }
}

// Composant Input Field
const InputField = ({ label, value, onChange, unit, placeholder }) => (
  <div className="form-group">
    <label className="form-label">{label}</label>
    <div className={unit ? "input-group" : ""}>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="form-input"
      />
      {unit && <span className="input-addon">{unit}</span>}
    </div>
  </div>
);

// Composant Unit Selector
const UnitSelector = ({ selectedUnit, onUnitChange, units }) => (
  <div className="form-group">
    <label className="form-label">Unité source</label>
    <div className="btn-group">
      {units.map((unit) => (
        <button
          key={unit}
          onClick={() => onUnitChange(unit)}
          className={selectedUnit === unit ? 'btn btn-primary' : 'btn btn-secondary'}
        >
          {unit}
        </button>
      ))}
    </div>
  </div>
);

// Composant Results Display
const ResultsDisplay = ({ results, title }) => (
  <div className="results-container">
    <h3 className="results-title">{title}</h3>
    <div>
      {Object.entries(results).map(([unit, value]) => (
        <div key={unit} className="results-item">
          <span className="results-label">{unit}:</span>
          <span className="results-value">
            {typeof value === 'number' ? value.toFixed(4) : value}
          </span>
        </div>
      ))}
    </div>
  </div>
);

// Composant Usage Display pour ZFS
const UsageDisplay = ({ totalSpace, usedSpace, freeSpace, percentUsed, unit }) => {
  const getProgressClass = (percent) => {
    if (percent >= 90) return 'progress-critical';
    if (percent >= 75) return 'progress-warning';
    return 'progress-safe';
  };

  const formatValue = (value) => {
    if (unit === 'mb') return (value / (1024 * 1024)).toFixed(2);
    return value.toFixed(0);
  };

  return (
    <div className="card">
      <h3 className="results-title">Utilisation ZFS</h3>
      
      <div className="progress-container">
        <div className="progress-header">
          <span>Utilisation</span>
          <span>{percentUsed.toFixed(1)}%</span>
        </div>
        <div className="progress-bar">
          <div
            className={`progress-fill ${getProgressClass(percentUsed)}`}
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          ></div>
        </div>
      </div>

      <div>
        <div className="results-item">
          <span className="results-label">Total:</span>
          <span className="results-value">
            {formatValue(totalSpace)} {unit.toUpperCase()}
          </span>
        </div>
        <div className="results-item">
          <span className="results-label">Utilisé:</span>
          <span className="results-value">
            {formatValue(usedSpace)} {unit.toUpperCase()}
          </span>
        </div>
        <div className="results-item">
          <span className="results-label">Libre:</span>
          <span className="results-value">
            {formatValue(freeSpace)} {unit.toUpperCase()}
          </span>
        </div>
      </div>

      {percentUsed >= 90 && (
        <div className="alert alert-critical">
          ⚠️ Utilisation critique - Expansion recommandée
        </div>
      )}
      {percentUsed >= 75 && percentUsed < 90 && (
        <div className="alert alert-warning">
          ⚠️ Utilisation élevée - Surveillance recommandée
        </div>
      )}
    </div>
  );
};

// Composant Simulation Panel - MODIFIÉ pour supporter les pourcentages
const SimulationPanel = ({ onSimulate, simulation }) => {
  const [spaceChange, setSpaceChange] = useState('');
  const [unit, setUnit] = useState('mb');

  const handleSimulate = () => {
    if (spaceChange && parseFloat(spaceChange) > 0) {
      onSimulate(parseFloat(spaceChange), unit);
    }
  };

  // Fonction pour formater toujours en MB et Bytes
  const formatValueInBytes = (bytes) => {
    return bytes.toFixed(0);
  };

  const formatValueInMB = (bytes) => {
    return (bytes / (1024 * 1024)).toFixed(2);
  };

  return (
    <div className="card">
      <h3 className="results-title">Simulation de consommation</h3>
      
      <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
        <input
          type="number"
          value={spaceChange}
          onChange={(e) => setSpaceChange(e.target.value)}
          placeholder={unit === 'percentage' ? 'Pourcentage à consommer (ex: 20)' : 'Espace à consommer'}
          className="form-input"
          style={{ flex: '1', minWidth: '200px' }}
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="form-input"
          style={{ width: 'auto' }}
        >
          <option value="percentage">% (Pourcentage)</option>
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
            <span className="results-label">Espace consommé:</span>
            <span className="results-value">
              {formatValueInMB(Math.abs(simulation.spaceChange))} MB ({formatValueInBytes(Math.abs(simulation.spaceChange))} bytes)
            </span>
          </div>
          <div className="results-item">
            <span className="results-label">Nouvel espace utilisé:</span>
            <span className="results-value">
              {formatValueInMB(simulation.projectedUsedSpace)} MB ({formatValueInBytes(simulation.projectedUsedSpace)} bytes)
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
              {formatValueInMB(simulation.projectedFreeSpace)} MB ({formatValueInBytes(simulation.projectedFreeSpace)} bytes)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Écran Convertisseur (Page Home)
const ConverterScreen = () => {
  const [inputValue, setInputValue] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('CYL');
  const [diskType, setDiskType] = useState('3390');
  const [results, setResults] = useState({});

  useEffect(() => {
    if (inputValue && parseFloat(inputValue) > 0) {
      const value = parseFloat(inputValue);
      const newResults = {};
      
      ['CYL', 'TRKS', 'MO'].forEach(unit => {
        if (unit !== selectedUnit) {
          newResults[unit] = ConversionService.convert(value, selectedUnit, unit, diskType);
        }
      });
      
      setResults(newResults);
    } else {
      setResults({});
    }
  }, [inputValue, selectedUnit, diskType]);

  return (
    <div className="space-y-6">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
        <Calculator style={{ marginRight: '0.5rem' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-accent)' }}>
          Convertisseur Mainframe
        </h2>
      </div>
      
      <div className="form-group">
        <label className="form-label">Type de disque</label>
        <select
          value={diskType}
          onChange={(e) => setDiskType(e.target.value)}
          className="form-input"
        >
          {Object.entries(DISK_TYPES).map(([id, type]) => (
            <option key={id} value={id}>{type.name}</option>
          ))}
        </select>
      </div>

      <InputField
        label="Valeur à convertir"
        value={inputValue}
        onChange={setInputValue}
        placeholder="Entrez une valeur"
      />

      <UnitSelector
        selectedUnit={selectedUnit}
        onUnitChange={setSelectedUnit}
        units={['CYL', 'TRKS', 'MO']}
      />

      {Object.keys(results).length > 0 && (
        <ResultsDisplay results={results} title="Résultats de conversion" />
      )}

      <div className="card">
        <h3 className="results-title">Formules de conversion ({DISK_TYPES[diskType].name})</h3>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontFamily: 'Monaco, Menlo, monospace' }}>
          <div>1 CYL = {DISK_TYPES[diskType].tracksPerCylinder} TRKS</div>
          <div>1 TRK = {DISK_TYPES[diskType].bytesPerTrack.toLocaleString()} bytes</div>
          <div>1 MB = 1,048,576 bytes</div>
        </div>
      </div>
    </div>
  );
};

// Écran ZFS Calculator
const ZfsScreen = () => {
  const [totalSpace, setTotalSpace] = useState('');
  const [freeSpace, setFreeSpace] = useState('');
  const [unit, setUnit] = useState('mb');
  const [simulation, setSimulation] = useState(null);

  const totalSpaceBytes = unit === 'mb' ? parseFloat(totalSpace || 0) * 1024 * 1024 : parseFloat(totalSpace || 0);
  const freeSpaceBytes = unit === 'mb' ? parseFloat(freeSpace || 0) * 1024 * 1024 : parseFloat(freeSpace || 0);
  const usedSpaceBytes = totalSpaceBytes - freeSpaceBytes; // Calculé automatiquement
  const percentUsed = ZfsCalculatorService.calculateUsagePercentage(usedSpaceBytes, totalSpaceBytes);

  const handleSimulation = (spaceChange, simUnit) => {
    const currentZfs = {
      totalSpace: totalSpaceBytes,
      usedSpace: usedSpaceBytes,
      freeSpace: freeSpaceBytes
    };
    
    const result = ZfsCalculatorService.simulateExpansion(currentZfs, spaceChange, simUnit);
    setSimulation(result);
  };

  return (
    <div className="space-y-6">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
        <Database style={{ marginRight: '0.5rem' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-accent)' }}>
          Calculateur ZFS
        </h2>
      </div>

      <div className="form-group">
        <label className="form-label">Unité d'affichage</label>
        <div className="btn-group">
          <button
            onClick={() => setUnit('bytes')}
            className={unit === 'bytes' ? 'btn btn-primary' : 'btn btn-secondary'}
          >
            Bytes
          </button>
          <button
            onClick={() => setUnit('mb')}
            className={unit === 'mb' ? 'btn btn-primary' : 'btn btn-secondary'}
          >
            MB
          </button>
        </div>
      </div>

      <InputField
        label="Espace total"
        value={totalSpace}
        onChange={setTotalSpace}
        unit={unit.toUpperCase()}
        placeholder="Taille totale du zFS"
      />

      <InputField
        label="Espace libre"
        value={freeSpace}
        onChange={setFreeSpace}
        unit={unit.toUpperCase()}
        placeholder="Espace libre disponible"
      />

      {totalSpace && freeSpace && parseFloat(totalSpace) > 0 && parseFloat(freeSpace) >= 0 && (
        <UsageDisplay
          totalSpace={totalSpaceBytes}
          usedSpace={usedSpaceBytes}
          freeSpace={freeSpaceBytes}
          percentUsed={percentUsed}
          unit={unit}
        />
      )}

      {totalSpace && freeSpace && (
        <SimulationPanel
          onSimulate={handleSimulation}
          simulation={simulation}
        />
      )}
    </div>
  );
};

// Écran Historique
const HistoryScreen = () => (
  <div className="space-y-6">
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
      <History style={{ marginRight: '0.5rem' }} />
      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-accent)' }}>
        Historique
      </h2>
    </div>
    <div className="card text-center">
      <p style={{ color: 'var(--text-secondary)' }}>Aucun historique disponible</p>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-accent)', marginTop: '0.5rem' }}>
        Les conversions apparaîtront ici
      </p>
    </div>
  </div>
);

// Écran Paramètres
const SettingsScreen = () => (
  <div className="space-y-6">
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
      <Settings style={{ marginRight: '0.5rem' }} />
      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-accent)' }}>
        Paramètres
      </h2>
    </div>
    <div className="card">
      <h3 className="results-title">Configuration</h3>
      <div className="space-y-4">
        <div className="form-group">
          <label className="form-label">Précision d'affichage</label>
          <select className="form-input">
            <option>4 décimales</option>
            <option>2 décimales</option>
            <option>6 décimales</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Seuil d'alerte ZFS (%)</label>
          <input
            type="number"
            defaultValue="75"
            className="form-input"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Seuil critique ZFS (%)</label>
          <input
            type="number"
            defaultValue="90"
            className="form-input"
          />
        </div>
      </div>
    </div>
  </div>
);

// Composant Navigation
const Navigation = () => {
  const location = useLocation();
  
  const tabs = [
    { path: '/', label: 'Convertisseur', icon: Calculator },
    { path: '/zfs', label: 'ZFS', icon: Database },
    { path: '/history', label: 'Historique', icon: History },
    { path: '/settings', label: 'Paramètres', icon: Settings }
  ];

  return (
    <nav className="nav-container">
      <div className="nav-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`nav-tab ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span className="nav-tab-text sm-inline">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

// Application principale avec React Router
const App = () => {
  return (
    <div className="app-container">
      <header className="header">
        <h1>ZConvert - Convertisseur Mainframe</h1>
      </header>

      <Navigation />

      <main className="main-content">
        <Routes>
          <Route path="/" element={<ConverterScreen />} />
          <Route path="/zfs" element={<ZfsScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<ConverterScreen />} />
        </Routes>
      </main>

      <footer className="footer">
        ZConvert v1.0 - Convertisseur pour IBM z/OS
      </footer>
    </div>
  );
};

export default App;
