/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Header } from './components/Header';
import { ConfiguratorForm } from './components/ConfiguratorForm';
import { Room3DViewer } from './components/Room3DViewer';
import { FloorPlan2D } from './components/FloorPlan2D';
import { BillOfMaterials } from './components/BillOfMaterials';
import { KnaufGuideModal } from './components/KnaufGuideModal';
import { RoomConfig } from './types';
import { generateAsymmetricCorners } from './utils/geometry';
import { calculateDrywallBOM } from './utils/calculator';
import { 
  Box, 
  Ruler, 
  FileText, 
  Layers, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle,
  Coins,
  Maximize2
} from 'lucide-react';

export default function App() {
  // Default configuration: Asymmetric room with crooked corners to demonstrate straightening & framing
  const [config, setConfig] = useState<RoomConfig>(() => {
    const defaultLength = 500;
    const defaultWidth = 380;
    return {
      shape: 'asymmetric',
      length: defaultLength,
      width: defaultWidth,
      height: 260,
      corners: generateAsymmetricCorners(defaultLength, defaultWidth, 40),
      constructionMode: 'freestanding_lining',
      studSpacing: 600,
      studProfile: 'CW_50',
      trackProfile: 'UW_50',
      profileLengthMeters: 3.0,
      enableStraightening: true,
      straightenWallDistance: 5,
      boardType: 'standard',
      boardLayers: 1,
      boardSize: '2000x1250',
      hasInsulation: true,
      insulationType: 'mineral_wool_50',
      ceilingMode: 'double_cd', // D112 Knauf dvorazinski spušteni strop omogućen po defaultu
      ceilingHangerType: 'wire_anchor',
      ceilingDropDistanceCm: 15,
      ceilingPrimarySpacing: 900,
      ceilingSecondarySpacing: 500,
      ceilingHangerSpacing: 800,
      ceilingBoardLayers: 1,
      ceilingHasInsulation: true,
      ceilingInsulationThickness: 50,
      openings: [
        {
          id: 'op_door_1',
          type: 'door',
          name: 'Vrata sobe',
          wallIndex: 0,
          distanceFromStart: 60,
          width: 90,
          height: 205,
          useUAProfile: true, // UA profile with mounting brackets
        },
        {
          id: 'op_win_1',
          type: 'window',
          name: 'Prozor',
          wallIndex: 2,
          distanceFromStart: 120,
          width: 140,
          height: 130,
          sillHeight: 90,
        },
      ],
      partitionWalls: [],
    };
  });

  const [mainView, setMainView] = useState<'3d' | '2d' | 'bom'>('3d');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});

  // Recalculate BOM in real time
  const summary = useMemo(() => {
    return calculateDrywallBOM(config, customPrices);
  }, [config, customPrices]);

  const handlePriceChange = (key: string, value: number) => {
    setCustomPrices(prev => ({ ...prev, [key]: value }));
  };

  const handleResetPrices = () => {
    setCustomPrices({});
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-800 flex flex-col font-sans">
      {/* Top Application Header */}
      <Header
        onOpenGuide={() => setIsGuideOpen(true)}
        onSelectPreset={(preset) => setConfig(preset)}
      />

      {/* Quick Status & Metric Bar */}
      <div className="bg-white border-b border-slate-300 shadow-2xs">
        <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 sm:gap-6">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Dimenzije:</span>
              <strong className="text-slate-900 font-mono">
                {(config.length / 100).toFixed(2)}m × {(config.width / 100).toFixed(2)}m (h={(config.height / 100).toFixed(2)}m)
              </strong>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Neto zidna obloga:</span>
              <strong className="text-[#00529B] font-mono font-bold">{summary.totalWallAreaNet} m²</strong>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Vertikalni profili:</span>
              <strong className="text-slate-900 font-mono">{summary.totalStudsCount} kom</strong>
            </div>

            {config.shape === 'asymmetric' && (
              <div className="flex items-center gap-1 text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px] font-medium">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Izravnavanje: <strong>{config.enableStraightening ? 'Uključeno (90°)' : 'Isključeno'}</strong></span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Procjena materijala s PDV:</span>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 font-bold font-mono text-sm rounded border border-emerald-300">
              {summary.grandTotalCost.toFixed(2)} €
            </span>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <main className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex-1 space-y-4">
        {/* View Switcher Tabs (3D Visualizer | 2D Topography & Floorplan | Bill of Materials) */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-300 pb-2">
          <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-lg">
            <button
              id="view_tab_3d"
              type="button"
              onClick={() => setMainView('3d')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition-all ${
                mainView === '3d'
                  ? 'bg-white text-[#00529B] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/60'
              }`}
            >
              <Box className="w-4 h-4" />
              <span>3D Vizualizacija</span>
            </button>

            <button
              id="view_tab_2d"
              type="button"
              onClick={() => setMainView('2d')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition-all ${
                mainView === '2d'
                  ? 'bg-white text-[#00529B] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/60'
              }`}
            >
              <Ruler className="w-4 h-4" />
              <span>2D Topografija</span>
            </button>

            <button
              id="view_tab_bom"
              type="button"
              onClick={() => setMainView('bom')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition-all ${
                mainView === 'bom'
                  ? 'bg-white text-[#00529B] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/60'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Troškovnik & Shopping Lista</span>
            </button>
          </div>
        </div>

        {/* Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Main Visual / Content Area (Col 7 or 12 depending on view) */}
          <div className={`${mainView === 'bom' ? 'lg:col-span-12' : 'lg:col-span-7 xl:col-span-7'} space-y-4`}>
            {mainView === '3d' && (
              <div className="space-y-4">
                <Room3DViewer config={config} />
                
                {/* Visualizer Guidance */}
                <div className="bg-white rounded-lg border border-slate-300 p-3.5 text-xs text-slate-600 flex items-start gap-2.5 shadow-2xs">
                  <div className="p-1.5 bg-blue-50 text-[#00529B] rounded shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-slate-900 block mb-0.5 uppercase text-[11px] tracking-wide font-bold">Upute za 3D pregled:</strong>
                    Rotirajte model lijevom tipkom miša, približavajte kotačićem. Upotrijebite prekidače na desnoj strani za uključivanje/isključivanje gips ploča, mineralne vune, laserskih linija poravnanja ili za razmicanje slojeva (exploded view).
                  </div>
                </div>
              </div>
            )}

            {mainView === '2d' && (
              <div className="space-y-4">
                <FloorPlan2D config={config} onChange={(newConf) => setConfig(newConf)} />
              </div>
            )}

            {mainView === 'bom' && (
              <BillOfMaterials
                summary={summary}
                config={config}
                customPrices={customPrices}
                onPriceChange={handlePriceChange}
                onResetPrices={handleResetPrices}
              />
            )}
          </div>

          {/* Configuration Parameters Panel (Col 5) - shown in 3D and 2D views */}
          {mainView !== 'bom' && (
            <div className="lg:col-span-5 xl:col-span-5 space-y-4">
              <ConfiguratorForm
                config={config}
                onChange={(newConf) => setConfig(newConf)}
              />

              {/* Quick BOM preview card */}
              <div className="bg-white rounded-lg border border-slate-300 p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#00529B]" />
                    Brzi pregled materijala
                  </span>
                  <button
                    type="button"
                    onClick={() => setMainView('bom')}
                    className="text-xs text-[#00529B] hover:text-blue-900 font-bold hover:underline"
                  >
                    Puni troškovnik →
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Profili CW/CD:</span>
                    <strong className="font-mono text-slate-900 text-sm">{summary.totalStudsCount} kom</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Vodilice UW/UD:</span>
                    <strong className="font-mono text-slate-900 text-sm">{summary.totalTracksLengthM} m'</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Knauf ploče (2.5m²):</span>
                    <strong className="font-mono text-[#00529B] text-sm">
                      {summary.items.find(i => i.category === 'boards')?.packagesNeeded || 0} kom
                    </strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Vijci TN 25/35:</span>
                    <strong className="font-mono text-slate-900 text-sm">
                      {summary.items.filter(i => i.id.startsWith('mat_screws_tn')).reduce((s, i) => s + i.exactQuantity, 0)} kom
                    </strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Ukupno materijal s PDV:</span>
                  <strong className="text-base font-bold text-emerald-700 font-mono">
                    {summary.grandTotalCost.toFixed(2)} €
                  </strong>
                </div>

                <button
                  id="btn_quick_view_bom"
                  type="button"
                  onClick={() => setMainView('bom')}
                  className="w-full rounded bg-emerald-600 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-colors text-center"
                >
                  IZRAČUNAJ & OTVORI TROŠKOVNIK
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Assembly Guide Modal */}
      <KnaufGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-300 mt-10 py-3.5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-semibold text-slate-700">Drywall Master Pro & KnaufCalc 3D — Tehnički konfigurator potkonstrukcije</span>
          <span className="text-slate-400">Standardi: Knauf W623 / W625 / W111 / W112 / HRN EN 520</span>
        </div>
      </footer>
    </div>
  );
}
