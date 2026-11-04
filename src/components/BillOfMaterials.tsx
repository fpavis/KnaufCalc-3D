import React, { useState } from 'react';
import { CalculatedSummary, MaterialItem, RoomConfig } from '../types';
import { generateBOMPdf } from '../utils/pdfGenerator';
import { 
  Printer, 
  Download, 
  Copy, 
  Check, 
  ShoppingCart, 
  FileText, 
  Edit3, 
  RotateCcw, 
  Layers, 
  Coins,
  Package,
  Wrench,
  Sparkles,
  Info,
  FileType
} from 'lucide-react';

interface BillOfMaterialsProps {
  summary: CalculatedSummary;
  config: RoomConfig;
  customPrices: Record<string, number>;
  onPriceChange: (key: string, value: number) => void;
  onResetPrices: () => void;
}

export const BillOfMaterials: React.FC<BillOfMaterialsProps> = ({
  summary,
  config,
  customPrices,
  onPriceChange,
  onResetPrices,
}) => {
  const [viewMode, setViewMode] = useState<'detailed' | 'shopping_list'>('detailed');
  const [copied, setCopied] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [isEditingPrices, setIsEditingPrices] = useState(false);

  // Group items by category
  const categories: { key: MaterialItem['category']; label: string; icon: string }[] = [
    { key: 'profiles', label: '1. Metalni Profili (CW / UW / CD / UD / UA)', icon: '🏗️' },
    { key: 'hangers_connectors', label: '2. Nosači, Ovjesi i Brtvljenje', icon: '🔩' },
    { key: 'fasteners', label: '3. Vijci, Tipli i Pričvrsni Pribor', icon: '🪛' },
    { key: 'boards', label: '4. Gipskartonske Ploče (Knauf)', icon: '📄' },
    { key: 'insulation', label: '5. Izolacija (Mineralna Vuna)', icon: '🧱' },
    { key: 'finishing', label: '6. Obrada Spojeva i Fugiranje', icon: '✨' },
  ];

  const toggleCheckItem = (id: string) => {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Copy to clipboard
  const handleCopy = () => {
    let text = `=================================================\n`;
    text += `KNAUF SPECIFIKACIJA MATERIJALA & SHOPPING LISTA\n`;
    text += `Dimenzije: ${(config.length / 100).toFixed(2)}m x ${(config.width / 100).toFixed(2)}m (h=${(config.height / 100).toFixed(2)}m)\n`;
    text += `Neto površina obloge: ${summary.totalWallAreaNet} m² | Ploče: ${summary.totalBoardAreaNeeded} m²\n`;
    text += `=================================================\n\n`;

    categories.forEach(cat => {
      const items = summary.items.filter(i => i.category === cat.key);
      if (items.length > 0) {
        text += `[ ${cat.label} ]\n`;
        items.forEach(i => {
          text += `- ${i.name}: ${i.packagesNeeded} ${i.packageUnit} (${i.totalPrice.toFixed(2)} €)\n`;
        });
        text += `\n`;
      }
    });

    text += `-------------------------------------------------\n`;
    text += `Ukupno bez PDV: ${summary.netTotalCost.toFixed(2)} €\n`;
    text += `PDV (25%): ${summary.vatAmount.toFixed(2)} €\n`;
    text += `UKUPNO ZA PLATITI: ${summary.grandTotalCost.toFixed(2)} €\n`;
    text += `=================================================\n`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Export CSV
  const handleExportCSV = () => {
    let csv = `Kategorija;Naziv Artikla;Knauf Šifra;Količina;Jedinica;Pakiranje;Cijena po pakiranju (EUR);Ukupno (EUR)\n`;
    summary.items.forEach(i => {
      csv += `"${i.category}";"${i.name}";"${i.code}";"${i.packagesNeeded}";"${i.packageUnit}";"${i.packageSize}";"${i.unitPrice.toFixed(2)}";"${i.totalPrice.toFixed(2)}"\n`;
    });
    csv += `\n;;;;;Ukupno bez PDV:;;${summary.netTotalCost.toFixed(2)}\n`;
    csv += `;;;;;PDV (25%):;;${summary.vatAmount.toFixed(2)}\n`;
    csv += `;;;;;SVEUKUPNO S PDV:;;${summary.grandTotalCost.toFixed(2)}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Knauf_Troskovnik_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-300 shadow-2xs overflow-hidden p-4 sm:p-6 space-y-6 print:p-0 print:border-none print:shadow-none">
      {/* Header & Print Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-300 pb-4 print:border-b-2 print:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold uppercase tracking-tight text-slate-900">
              Troškovnik & Popis Materijala (Bill of Materials)
            </h2>
            <span className="px-2 py-0.5 bg-blue-50 text-[#00529B] font-bold text-[10px] uppercase tracking-wider rounded border border-blue-200">
              Automatski Proračun
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Standardizirani normativi suhe gradnje s uračunatim rezom i preklopima (DIN 18181)
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <div className="bg-slate-100 p-1 rounded flex items-center gap-1 text-xs">
            <button
              id="btn_view_detailed"
              type="button"
              onClick={() => setViewMode('detailed')}
              className={`px-3 py-1 font-bold uppercase tracking-wider rounded transition-colors text-[11px] ${
                viewMode === 'detailed' ? 'bg-white text-[#00529B] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 inline mr-1" />
              Detaljni Troškovnik
            </button>
            <button
              id="btn_view_shopping"
              type="button"
              onClick={() => setViewMode('shopping_list')}
              className={`px-3 py-1 font-bold uppercase tracking-wider rounded transition-colors text-[11px] ${
                viewMode === 'shopping_list' ? 'bg-white text-[#00529B] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5 inline mr-1" />
              Shopping Lista
            </button>
          </div>

          <button
            id="btn_download_pdf"
            type="button"
            onClick={() => generateBOMPdf(summary, config)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00529B] text-white hover:bg-blue-800 rounded text-xs font-bold uppercase tracking-wider shadow-2xs transition-colors"
            title="Preuzmi strukturirani PDF troškovnik s tablicom i normativima"
          >
            <FileType className="w-3.5 h-3.5" />
            <span>Preuzmi PDF</span>
          </button>

          <button
            id="btn_print_bom"
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded text-xs font-bold uppercase tracking-wider border border-slate-300 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Ispiši</span>
          </button>

          <button
            id="btn_copy_bom"
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded text-xs font-bold border border-slate-300 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Kopirano!' : 'Kopiraj'}</span>
          </button>

          <button
            id="btn_export_csv"
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded text-xs font-bold border border-slate-300 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 p-3 rounded border border-slate-200">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Neto Površina Zidova:</span>
          <span className="text-lg font-bold text-slate-900 font-mono">{summary.totalWallAreaNet} m²</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Bruto: {summary.totalWallAreaGross} m²</span>
        </div>

        <div className="bg-blue-50 p-3 rounded border border-blue-200">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#00529B] block">Gips Ploče (Ukupno):</span>
          <span className="text-lg font-bold text-[#00529B] font-mono">
            {summary.boardCalculation?.totalBoardsCount || summary.items.find(i => i.category === 'boards')?.packagesNeeded || 0} kom
          </span>
          <span className="text-[10px] text-blue-700 block mt-0.5 font-medium">
            {summary.boardCalculation?.totalFullBoardsCount || 0} cijelih + {summary.boardCalculation?.totalCutBoardsCount || 0} rezanih
          </span>
        </div>

        <div className="bg-slate-50 p-3 rounded border border-slate-200">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Vertikalni Profili (CW/CD):</span>
          <span className="text-lg font-bold text-slate-900 font-mono">{summary.totalStudsCount} kom</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Razmak {config.studSpacing} mm</span>
        </div>

        <div className="bg-emerald-50 p-3 rounded border border-emerald-300">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Ukupni Trošak s PDV:</span>
          <span className="text-lg font-bold text-emerald-950 font-mono">{summary.grandTotalCost.toFixed(2)} €</span>
          <span className="text-[10px] text-emerald-700 block mt-0.5">Bez PDV: {summary.netTotalCost.toFixed(2)} €</span>
        </div>
      </div>

      {/* ================= DEDICATED GYPSUM BOARDS CUTTING & QUANTITY BREAKDOWN ================= */}
      {summary.boardCalculation && (
        <div className="bg-blue-50/40 rounded-lg border border-blue-200 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#00529B] text-white rounded">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <span>Proračun i Plan Rezanja Gipskartonskih Ploča</span>
                  <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-[#00529B] rounded font-bold font-mono">
                    Format {summary.boardCalculation.singleBoardLengthCm}×{summary.boardCalculation.singleBoardWidthCm} cm ({summary.boardCalculation.singleBoardAreaM2} m²)
                  </span>
                </h3>
                <p className="text-xs text-slate-600">
                  Točan izračun cijelih ploča, rezanih komada, broja rezova i raspodjele po zidovima
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="px-2.5 py-1 bg-white rounded border border-blue-200 text-slate-700 font-mono">
                Iskoristivost: <strong className="text-emerald-700">{summary.boardCalculation.utilizationRatePercent}%</strong>
              </span>
              <span className="px-2.5 py-1 bg-white rounded border border-blue-200 text-slate-700 font-mono">
                Tehnički otpad: <strong className="text-amber-700">{summary.boardCalculation.wastePercent}% ({summary.boardCalculation.wasteAreaM2} m²)</strong>
              </span>
            </div>
          </div>

          {/* Quick Cutting Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-white p-3 rounded border border-blue-200 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ukupno za naručiti</span>
              <span className="text-xl font-bold text-[#00529B] font-mono">{summary.boardCalculation.totalBoardsCount} kom</span>
              <span className="text-[10px] text-slate-500 block">{(summary.boardCalculation.totalBoardsCount * summary.boardCalculation.singleBoardAreaM2).toFixed(1)} m²</span>
            </div>

            <div className="bg-white p-3 rounded border border-emerald-200 text-center">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Cijele (nepiljene) ploče</span>
              <span className="text-xl font-bold text-emerald-700 font-mono">{summary.boardCalculation.totalFullBoardsCount} kom</span>
              <span className="text-[10px] text-emerald-600 block">Ugrađuju se u punom formatu</span>
            </div>

            <div className="bg-white p-3 rounded border border-amber-200 text-center">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Ploče koje se režu</span>
              <span className="text-xl font-bold text-amber-700 font-mono">{summary.boardCalculation.totalCutBoardsCount} kom</span>
              <span className="text-[10px] text-amber-600 block">Doštukavanje, krajevi i otvori</span>
            </div>

            <div className="bg-white p-3 rounded border border-purple-200 text-center">
              <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">Ukupan broj rezova</span>
              <span className="text-xl font-bold text-purple-700 font-mono">{summary.boardCalculation.totalCutsEstimated} rezova</span>
              <span className="text-[10px] text-purple-600 block">Skalpel / pila za gips</span>
            </div>
          </div>

          {/* Detailed Per-Surface Table */}
          <div className="overflow-x-auto border border-blue-200 rounded bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-blue-50/80 border-b border-blue-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-2.5">Površina (Zid / Strop)</th>
                  <th className="p-2.5 text-center">Dimenzije</th>
                  <th className="p-2.5 text-center">Neto m²</th>
                  <th className="p-2.5 text-center">Slojevi</th>
                  <th className="p-2.5 text-center text-emerald-700">Cijele ploče</th>
                  <th className="p-2.5 text-center text-amber-700">Rezani komadi</th>
                  <th className="p-2.5 text-center font-bold text-[#00529B]">Utrošak ploča</th>
                  <th className="p-2.5">Plan rezanja i tehničke napomene</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {summary.boardCalculation.surfaces.map((s, sIdx) => (
                  <tr key={sIdx} className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold text-slate-900">
                      {s.surfaceName}
                    </td>
                    <td className="p-2.5 text-center font-mono text-slate-600">
                      {s.heightM > 0 ? `${s.lengthM}m × ${s.heightM}m` : `${s.lengthM}m dužina`}
                    </td>
                    <td className="p-2.5 text-center font-mono font-semibold text-slate-800">
                      {s.areaNetM2} m²
                    </td>
                    <td className="p-2.5 text-center font-mono">
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-bold text-[10px]">
                        {s.layers} sloj{s.layers > 1 ? 'a' : ''}
                      </span>
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-emerald-700">
                      {s.fullBoardsCount} kom
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-amber-700">
                      {s.cutPiecesCount} kom
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-[#00529B] bg-blue-50/50">
                      {s.boardsUsedCount} kom
                    </td>
                    <td className="p-2.5 text-[11px] text-slate-600 space-y-0.5">
                      {s.cutsSummary.map((cut, cIdx) => (
                        <div key={cIdx} className="flex items-center gap-1.5 text-slate-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                          <span>{cut}</span>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Knauf Technical Drylining Rules for Board Cutting */}
          <div className="bg-amber-50/70 border border-amber-300 rounded p-3 text-xs text-amber-950 space-y-1">
            <div className="font-bold flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              <span>Važna Knauf pravila za rezanje i montažu gipskartonskih ploča:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-900">
              <li><strong>L-kroj oko vrata i prozora:</strong> Spoj ploča nikada ne smije biti u ravnini s vertikalnim dovratnikom (kutom otvora), već ploča mora prelaziti kut za minimalno 15-20 cm ("L-rez") radi sprječavanja pojave pukotina od vibracija otvaranja vrata.</li>
              <li><strong>Smaknuti poprečni spojevi:</strong> Ako je visina zida veća od duljine ploče, poprečni spojevi susjednih ploča moraju biti smaknuti za najmanje 40 cm (križni spojevi su strogo zabranjeni).</li>
              <li><strong>Razmak od poda:</strong> Ploče se montiraju s odmakom od 5-10 mm od gotovog poda radi dilatacije i zaštite od vlage.</li>
            </ul>
          </div>
        </div>
      )}

      {/* ================= DEDICATED MINERAL WOOL INSULATION CALCULATION (DEDUCTING OPENINGS) ================= */}
      {config.hasInsulation && summary.insulationCalculation && (
        <div className="bg-amber-50/40 rounded-lg border border-amber-200 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-600 text-white rounded">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <span>Proračun i Krojenje Mineralne Vune (Knauf Insulation)</span>
                  <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-bold font-mono">
                    Odbijeni svi otvori vrata i prozora
                  </span>
                </h3>
                <p className="text-xs text-slate-600">
                  Točan izračun neto kvadrature izolacije s odbijanjem otvora, ugradnjom u nadvratnike i parapete
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="px-2.5 py-1 bg-white rounded border border-amber-200 text-slate-700 font-mono">
                Odbitak otvora: <strong className="text-amber-800">-{summary.insulationCalculation.totalOpeningsAreaM2} m²</strong>
              </span>
              <span className="px-2.5 py-1 bg-white rounded border border-amber-200 text-slate-700 font-mono">
                Neto izolacija: <strong className="text-emerald-700">{summary.insulationCalculation.totalNetInsulationAreaM2} m²</strong>
              </span>
            </div>
          </div>

          {/* Quick Insulation Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-white p-3 rounded border border-amber-200 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Neto površina vune</span>
              <span className="text-xl font-bold text-amber-700 font-mono">{summary.insulationCalculation.totalNetInsulationAreaM2} m²</span>
              <span className="text-[10px] text-slate-500 block">Bruto: {summary.insulationCalculation.totalGrossAreaM2} m²</span>
            </div>

            <div className="bg-white p-3 rounded border border-emerald-200 text-center">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Pakiranja za naručiti</span>
              <span className="text-xl font-bold text-emerald-700 font-mono">{summary.insulationCalculation.totalPackagesNeeded} pak</span>
              <span className="text-[10px] text-emerald-600 block">{summary.insulationCalculation.singlePackageAreaM2} m² po paketu</span>
            </div>

            <div className="bg-white p-3 rounded border border-blue-200 text-center">
              <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">Ušteda na otvorima</span>
              <span className="text-xl font-bold text-blue-700 font-mono">{summary.insulationCalculation.totalOpeningsAreaM2} m²</span>
              <span className="text-[10px] text-blue-600 block">Odbijeni prozori i vrata</span>
            </div>

            <div className="bg-white p-3 rounded border border-purple-200 text-center">
              <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">Standard ugradnje</span>
              <span className="text-xl font-bold text-purple-700 font-mono">HRN EN ISO</span>
              <span className="text-[10px] text-purple-600 block">Zvučna i termoizolacija</span>
            </div>
          </div>

          {/* Detailed Per-Surface Table for Insulation */}
          <div className="overflow-x-auto border border-amber-200 rounded bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-amber-50/80 border-b border-amber-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-2.5">Pozicija (Zid / Pregrada / Strop)</th>
                  <th className="p-2.5 text-center">Dimenzije</th>
                  <th className="p-2.5 text-center">Bruto m²</th>
                  <th className="p-2.5 text-center text-amber-700">Otvori (-m²)</th>
                  <th className="p-2.5 text-center font-bold text-emerald-700">Neto vuna (m²)</th>
                  <th className="p-2.5 text-center font-bold text-slate-900">Potrebno paketa</th>
                  <th className="p-2.5">Raspored vune oko otvora i konstrukcije</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {summary.insulationCalculation.surfaces.map((s, sIdx) => (
                  <tr key={sIdx} className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold text-slate-900">
                      {s.surfaceName}
                    </td>
                    <td className="p-2.5 text-center font-mono text-slate-600">
                      {s.heightM > 0 ? `${s.lengthM}m × ${s.heightM}m` : `${s.lengthM}m obod`}
                    </td>
                    <td className="p-2.5 text-center font-mono text-slate-600">
                      {s.areaGrossM2} m²
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-amber-700">
                      {s.openingsAreaM2 > 0 ? `-${s.openingsAreaM2} m²` : '0 m²'}
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-emerald-700 bg-emerald-50/40">
                      {s.areaNetM2} m²
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-slate-900">
                      {s.packagesNeeded} pak
                    </td>
                    <td className="p-2.5 text-[11px] text-slate-600 space-y-0.5">
                      {s.piecesSummary.map((note, nIdx) => (
                        <div key={nIdx} className="flex items-center gap-1.5 text-slate-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                          <span>{note}</span>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Knauf Insulation Rules */}
          <div className="bg-amber-50/70 border border-amber-300 rounded p-3 text-xs text-amber-950 space-y-1">
            <div className="font-bold flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              <span>Pravila ugradnje mineralne vune u suhu gradnju:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-900">
              <li><strong>Bez zračnih praznina:</strong> Vuna se ulaže u cjelokupnu šupljinu između CW vertikala bez prekida ili propadanja radi sprječavanja akustičnih mostova.</li>
              <li><strong>Otvori vrata i prozora:</strong> Vuna se kroji i postavlja bočno uz ojačane profile dovratnika, u šupljine nadvratnika iznad otvora te ispod prozorskog parapeta. Unutar čistog prolaza otvora nema vune.</li>
              <li><strong>Debljina:</strong> Debljina vune mora odgovarati širini CW profila (CW 50 → vuna 50 mm, CW 75 → vuna 75 mm, CW 100 → vuna 100 mm).</li>
            </ul>
          </div>
        </div>
      )}

      {/* Expert Recommendations / Warnings if any */}
      {summary.recommendations.length > 0 && (
        <div className="space-y-1.5">
          {summary.recommendations.map((rec, rIdx) => (
            <div key={rIdx} className="bg-emerald-50 border border-emerald-200 rounded p-2.5 text-xs text-emerald-900 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{rec}</span>
            </div>
          ))}
        </div>
      )}

      {/* DETAILED TABLE VIEW */}
      {viewMode === 'detailed' && (
        <div className="space-y-6">
          {categories.map(cat => {
            const catItems = summary.items.filter(i => i.category === cat.key);
            if (catItems.length === 0) return null;

            return (
              <div key={cat.key} className="space-y-2">
                <div className="flex items-center justify-between bg-slate-100 px-3 py-2 rounded text-xs font-bold text-slate-800 border-l-4 border-[#00529B]">
                  <div className="flex items-center gap-2 uppercase tracking-wide">
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </div>
                  <span className="text-slate-500 font-normal text-[11px]">
                    {catItems.length} {catItems.length === 1 ? 'stavka' : 'stavke'}
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-2.5">Artikl & Opis</th>
                        <th className="p-2.5 w-24">Šifra</th>
                        <th className="p-2.5 text-right w-24">Potrebno</th>
                        <th className="p-2.5 text-right w-28">Kupiti pakiranje</th>
                        <th className="p-2.5 text-right w-24">Cijena/pak</th>
                        <th className="p-2.5 text-right w-28">Ukupno</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {catItems.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-2.5">
                            <div className="font-bold text-slate-900">{item.name}</div>
                            <div className="text-[11px] text-slate-500">{item.description}</div>
                            <div className="text-[10px] text-[#00529B] font-mono mt-0.5">{item.formulaNote}</div>
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-500">{item.code}</td>
                          <td className="p-2.5 text-right font-mono font-medium">
                            {item.exactQuantity} {item.unit}
                          </td>
                          <td className="p-2.5 text-right">
                            <span className="inline-block px-2 py-0.5 bg-slate-100 font-bold font-mono text-slate-900 rounded border border-slate-200">
                              {item.packagesNeeded} {item.packageUnit}
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-mono">
                            {item.unitPrice.toFixed(2)} €
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                            {item.totalPrice.toFixed(2)} €
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SHOPPING LIST (CHECKLIST) VIEW FOR RETAIL PURCHASING */}
      {viewMode === 'shopping_list' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 p-3 rounded text-xs text-amber-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-amber-700" />
              <span>
                Praktična lista za kupovinu u građevinskom centru (Pevex, Bauhaus, ProfiCentar). Označite kupljene stavke!
              </span>
            </div>
            <span className="font-bold uppercase text-[11px]">
              Označeno: {Object.values(checkedItems).filter(Boolean).length} / {summary.items.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {summary.items.map(item => {
              const isChecked = !!checkedItems[item.id];
              return (
                <div
                  key={item.id}
                  onClick={() => toggleCheckItem(item.id)}
                  className={`p-3 rounded border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                    isChecked
                      ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950 opacity-75'
                      : 'bg-white border-slate-300 hover:border-[#00529B] shadow-2xs'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // handled by parent div click
                      className="mt-1 h-4 w-4 rounded text-[#00529B] focus:ring-[#00529B]"
                    />
                    <div>
                      <div className={`font-bold text-xs ${isChecked ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                        {item.name}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Pakiranje: <strong>{item.packageUnit}</strong> ({item.packageSize} {item.unit})
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        Šifra: {item.code}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="px-2 py-1 bg-blue-50 text-[#00529B] font-bold font-mono text-xs rounded border border-blue-200">
                      {item.packagesNeeded} {item.packageUnit}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 mt-1">
                      cca {item.totalPrice.toFixed(2)} €
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Financial Summary & Total Block */}
      <div className="bg-[#00529B] text-white rounded-lg p-4 sm:p-6 space-y-3 print:bg-white print:text-black print:border print:border-slate-800">
        <div className="flex justify-between items-center text-xs text-blue-100 border-b border-blue-800 pb-2">
          <span className="uppercase font-semibold tracking-wide">Ukupni materijal bez PDV:</span>
          <span className="font-mono text-sm font-bold">{summary.netTotalCost.toFixed(2)} €</span>
        </div>

        <div className="flex justify-between items-center text-xs text-blue-100 border-b border-blue-800 pb-2">
          <span className="uppercase font-semibold tracking-wide">PDV ({summary.vatRate * 100}%):</span>
          <span className="font-mono text-sm font-bold">{summary.vatAmount.toFixed(2)} €</span>
        </div>

        <div className="flex justify-between items-center text-base sm:text-lg font-bold text-white pt-1">
          <span className="uppercase tracking-wide">SVEUKUPNO ZA PLATITI (s PDV):</span>
          <span className="font-mono text-xl sm:text-2xl text-emerald-300 print:text-black font-extrabold">
            {summary.grandTotalCost.toFixed(2)} €
          </span>
        </div>
      </div>

      {/* Printable Signature & Project Notes */}
      <div className="hidden print:block pt-8 border-t border-slate-300 text-xs text-slate-700">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <div className="font-bold mb-1 uppercase text-[11px]">Napomena za izvođača:</div>
            <p className="text-[10px] text-slate-600 leading-relaxed">
              Svi radovi moraju se izvoditi prema uputama proizvođača Knauf i važećim HRN / DIN standardima za suhu gradnju. Prije postavljanja obavezno zalijepiti PE akustičnu brtvenu traku na sve rubne UW/UD profile. Razmak vijaka na vertikalama iznosi max 25cm.
            </p>
          </div>
          <div className="space-y-8 text-right">
            <div>Datum izračuna: {new Date().toLocaleDateString('hr-HR')}</div>
            <div className="border-t border-slate-400 pt-1 inline-block min-w-[180px] text-center font-semibold">
              Potpis investitora / izvođača
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
