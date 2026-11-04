import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CalculatedSummary, RoomConfig, MaterialItem } from '../types';

export function generateBOMPdf(summary: CalculatedSummary, config: RoomConfig) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header Banner
  doc.setFillColor(0, 82, 155); // #00529B Knauf Blue
  doc.rect(0, 0, pageWidth, 26, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('KNAUFCALC 3D - TROSKOVNIK I SPECIFIKACIJA', 14, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Standardizirani normativi suhe gradnje prema HRN EN 520 / DIN 18181', 14, 18);

  doc.setFontSize(8);
  doc.text(`Datum: ${new Date().toLocaleDateString('hr-HR')}`, pageWidth - 14, 18, { align: 'right' });

  // Project Information Box
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(14, 30, pageWidth - 28, 28, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, 30, pageWidth - 28, 28, 2, 2, 'D');

  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('PARAMETRI PROSTORIJE I KONSTRUKCIJE:', 18, 36);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const col1X = 18;
  const col2X = 80;
  const col3X = 142;

  doc.text(`Dimenzije: ${(config.length / 100).toFixed(2)}m x ${(config.width / 100).toFixed(2)}m (h=${(config.height / 100).toFixed(2)}m)`, col1X, 42);
  doc.text(`Oblik sobe: ${config.shape === 'rectangular' ? 'Pravokutna (90°)' : config.shape === 'asymmetric' ? 'Nesimetrična (kosi kutevi)' : 'L-Oblik'}`, col1X, 47);
  doc.text(`Sustav obloge: ${config.constructionMode === 'wall_lining_direct' ? 'W623 Direktna obloga CD/UD' : 'W625 Samostojeći predzid CW/UW'}`, col1X, 52);

  doc.text(`Neto zidna obloga: ${summary.totalWallAreaNet} m2`, col2X, 42);
  doc.text(`Bruto povrsina zidova: ${summary.totalWallAreaGross} m2`, col2X, 47);
  doc.text(`Vertikalni profili (CW/CD): ${summary.totalStudsCount} kom (${config.studSpacing} mm)`, col2X, 52);

  doc.text(`Gips ploce: ${summary.totalBoardAreaNeeded} m2 (${config.boardType})`, col3X, 42);
  doc.text(`Broj slojeva ploca: ${config.boardLayers} sloj (${config.boardLayers === 2 ? '25 mm' : '12.5 mm'})`, col3X, 47);
  doc.text(`Spusteni strop: ${config.ceilingMode === 'none' ? 'Bez stropa' : config.ceilingMode === 'double_cd' ? 'D112 Dvorazinski CD/UD' : 'D113 Jednorazinski'}`, col3X, 52);

  // Group Categories Table
  const categories: { key: MaterialItem['category']; label: string }[] = [
    { key: 'profiles', label: '1. Metalni Profili (CW / UW / CD / UD / UA)' },
    { key: 'hangers_connectors', label: '2. Nosaci, Ovjesi i Brtvljenje' },
    { key: 'fasteners', label: '3. Vijci, Tipli i Pricvrsni Pribor' },
    { key: 'boards', label: '4. Gipskartonske Ploce (Knauf)' },
    { key: 'insulation', label: '5. Izolacija (Mineralna Vuna)' },
    { key: 'finishing', label: '6. Obrada Spojeva i Fugiranje' },
  ];

  const tableRows: any[] = [];

  categories.forEach(cat => {
    const items = summary.items.filter(i => i.category === cat.key);
    if (items.length > 0) {
      // Category header row
      tableRows.push([
        {
          content: cat.label,
          colSpan: 6,
          styles: { fillColor: [226, 232, 240], fontStyle: 'bold', textColor: [0, 82, 155] },
        },
      ]);

      items.forEach(item => {
        tableRows.push([
          item.name,
          item.code,
          `${item.exactQuantity} ${item.unit}`,
          `${item.packagesNeeded} ${item.packageUnit}`,
          `${item.unitPrice.toFixed(2)} EUR`,
          `${item.totalPrice.toFixed(2)} EUR`,
        ]);
      });
    }
  });

  autoTable(doc, {
    startY: 62,
    head: [['Naziv Stavke', 'Sifra', 'Tocna Kolicina', 'Pakiranje za kupnju', 'Cijena', 'Ukupno']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [0, 82, 155],
      textColor: 255,
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 26, halign: 'center' },
      2: { cellWidth: 24, halign: 'right' },
      3: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 200;

  // Check if we have space on current page for total and signature, else add page
  let currentY = finalY + 6;
  if (currentY > pageHeight - 45) {
    doc.addPage();
    currentY = 20;
  }

  // Totals Box
  doc.setFillColor(0, 82, 155);
  doc.roundedRect(pageWidth - 95, currentY, 81, 24, 1.5, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Ukupno bez PDV:`, pageWidth - 91, currentY + 6);
  doc.text(`${summary.netTotalCost.toFixed(2)} EUR`, pageWidth - 18, currentY + 6, { align: 'right' });

  doc.text(`PDV (25%):`, pageWidth - 91, currentY + 12);
  doc.text(`${summary.vatAmount.toFixed(2)} EUR`, pageWidth - 18, currentY + 12, { align: 'right' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`UKUPNO S PDV:`, pageWidth - 91, currentY + 19);
  doc.text(`${summary.grandTotalCost.toFixed(2)} EUR`, pageWidth - 18, currentY + 19, { align: 'right' });

  // Notes and signature
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Napomena: Normativi ukljucuju standardni tehnicki otpad i preklop suhe gradnje.', 14, currentY + 8);
  doc.text('Izvoditi radove u skladu s tehnickim listovima Knauf sustava W625 / W623 / D112.', 14, currentY + 13);
  doc.text(`Dokument generiran pomocu KnaufCalc 3D PRO softvera.`, 14, currentY + 18);

  // Download PDF
  const filename = `Knauf_Troskovnik_${(config.length / 100).toFixed(1)}x${(config.width / 100).toFixed(1)}m_${Date.now()}.pdf`;
  doc.save(filename);
}
