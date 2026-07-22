// backend/src/services/payslipGenerator.template.service.js
// Excel template-based payslip generation with proper merge handling
// COMPLETE VERSION with all requirements implemented

import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';
import htmlPdf from 'html-pdf-node';
import { uploadPayslip, getFileFromR2 } from '../config/storage.js';
import { encryptPayslipPDF } from '../utils/pdfEncryption.js';
import { sendPayslipNotificationEmail } from '../services/email.service.js';
import { getEntityPolicy } from '../helpers/policyResolver.js';
import prisma from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Path to template file
const TEMPLATE_PATH = path.join(__dirname, '../templates/Template_Payslip.xlsx');

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Abbreviate employee name: "Muhammad Harun Asrori" → "Muhammad Harun A."
 */
const abbreviateName = (fullName) => {
  const words = fullName.trim().split(' ');
  if (words.length <= 2) return fullName;
  
  const firstTwo = words.slice(0, 2).join(' ');
  const restAbbrev = words.slice(2).map(w => w.charAt(0).toUpperCase() + '.').join(' ');
  return `${firstTwo} ${restAbbrev}`;
};

/**
 * Generate payslip filename with new format
 * Format: {CompanyCode} - Payslip {AbbrevName} - {Month} {Year}.pdf
 * Example: "RFI - Payslip Muhammad Harun A. - February 2026.pdf"
 */
const generatePayslipFilename = (employeeName, plottingCompanyCode, period) => {
  const abbrevName = abbreviateName(employeeName);
  const monthName = MONTH_NAMES[period.month];
  
  return `${plottingCompanyCode} - Payslip ${abbrevName} - ${monthName} ${period.year}.pdf`;
};

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Get all sheet names from uploaded Excel file
 */
export const getExcelSheetNames = async (excelBuffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(excelBuffer);
  return workbook.worksheets.map(ws => ws.name);
};

/**
 * Recommend sheet name based on current month
 */
export const getRecommendedSheetName = (sheetNames, month) => {
  const monthName = MONTH_NAMES[month];
  
  const exactMatch = sheetNames.find(name => 
    name.toLowerCase() === monthName.toLowerCase()
  );
  if (exactMatch) return exactMatch;
  
  const partialMatch = sheetNames.find(name =>
    name.toLowerCase().includes(monthName.toLowerCase())
  );
  if (partialMatch) return partialMatch;
  
  return sheetNames[0] || null;
};

// ─── Excel Parser ─────────────────────────────────────────────────────────────

/**
 * Parse payroll data from selected sheet
 */
export const parsePayrollSheet = async (excelBuffer, sheetName) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(excelBuffer);
  
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }
  
  const employees = [];
  
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < 10) return;
    
    const name = row.getCell('B').value;
    if (!name || typeof name !== 'string') return;
    
    const getCellValue = (col) => {
      const cell = row.getCell(col);
      const v = cell.value;
      if (v && typeof v === 'object' && 'result' in v) return v.result;
      return v;
    };
    
    const parseNum = (col) => {
      const v = getCellValue(col);
      if (!v) return 0;
      if (typeof v === 'string') {
        const cleaned = v.replace(/[^0-9.-]/g, '');
        return parseFloat(cleaned) || 0;
      }
      return typeof v === 'number' ? v : 0;
    };
    
    // Special parser for percentage - handles both decimal and whole number formats
    const parsePercentage = (col) => {
      const cell = row.getCell(col);
      const v = getCellValue(col);
      
      // Log for debugging
      // console.log(`[Row ${rowNumber}] Cell ${col}:`, {
      //   rawValue: cell.value,
      //   numFmt: cell.numFmt,
      //   parsedValue: v,
      //   type: typeof v
      // });
      
      if (!v) return 0;
      
      // If it's a number
      if (typeof v === 'number') {
        // Excel percentages are stored as decimals (0.0175 = 1.75%)
        // Check if it's already a decimal (< 1) or a whole number (> 1)
        if (v < 1) {
          // Already decimal, multiply by 100 to get percentage
          return v * 100; // 0.0175 → 1.75
        } else {
          // Already a whole number percentage
          return v; // 1.75 → 1.75
        }
      }
      
      // If it's a string
      if (typeof v === 'string') {
        const cleaned = v.replace(/[^0-9.-]/g, '');
        const num = parseFloat(cleaned) || 0;
        return num < 1 ? num * 100 : num;
      }
      
      return 0;
    };
    
    const pph21Pct = parsePercentage('AE');
    
    employees.push({
      rowNumber,
      nik: String(getCellValue('E') || '').trim(),
      position: getCellValue('C') || '',
      
      // Earnings
      basicPay:        parseNum('H'),                           // GAJI/PENSIUN
      overtimePay:     parseNum('Y'),                           // LEMBUR
      bdd:             parseNum('X'),                           // BONUS
      prepaidTHR:      parseNum('Z'),                           // PREPAID BONUS (BDD + THR)

      // Health & Wellness components                         
      bpjskesEmployer: parseNum('N'),                           // PREMI BPJSKES 4%
      aiaBill:         parseNum('O'),                           // PREMI AIA
      jkk:             parseNum('Q'),                           // PREMI JKK 0.24%
      jkm:             parseNum('R'),                           // PREMI JKM 0.3%

      // Deductions                         
      pph21Percentage: pph21Pct,                                // TER percentage (converted to 1.75 format)
      kompensasiA1:    parseNum('AG'),                          // PPh 21 ADJUST (not AF)
      pph21Ter:        String(getCellValue('G') || '').trim(),  // PPh 21 ADJUST (not AF)
      pph21Adjust:     parseNum('AF'),                          // PPh 21 ADJUST (not AF)
      bpjstk:          parseNum('T'),                           // PREMI JHTK 2%
      bpjskes:         parseNum('U'),                           // PREMI JKES 1%
      famInsurance:    parseNum('AJ'),                          // FAMILY INSURANCE
      employeeLoan:    parseNum('AK'),                          // EMPLOYEE LOAN
      othersDeduction: parseNum('AL'),                          // OTHERS DEDUCTION
      
      // Totals
      grossPay:        parseNum('AC'),
      netPay:          parseNum('AN'),
    });
  });
  
  console.log('PPh 21 Ter:', employees.pph21Ter)
  console.log(`Parsed ${employees.length} employees from sheet "${sheetName}"`);
  
  return employees;
};

// ─── Excel to PDF Converter ───────────────────────────────────────────────────

/**
 * Convert Excel worksheet range to HTML with merged cells support
 */
async function excelRangeToHtml(sheet, range) {
  const [startCell, endCell] = range.split(':');
  const startRow = parseInt(startCell.match(/\d+/)[0]);
  const endRow = parseInt(endCell.match(/\d+/)[0]);
  const startCol = startCell.charCodeAt(0) - 64; // C=3
  const endCol = endCell.charCodeAt(0) - 64;     // F=6
  
  // Track merged cells
  const mergedCells = new Map();
  const skipCells = new Set();
  
  Object.keys(sheet._merges).forEach(mergeKey => {
    const merge = sheet._merges[mergeKey];
    const { top, left, bottom, right } = merge.model;
    
    if (top >= startRow && bottom <= endRow && left >= startCol && right <= endCol) {
      const rowspan = bottom - top + 1;
      const colspan = right - left + 1;
      mergedCells.set(`${top},${left}`, { rowspan, colspan });
      
      for (let r = top; r <= bottom; r++) {
        for (let c = left; c <= right; c++) {
          if (r !== top || c !== left) {
            skipCells.add(`${r},${c}`);
          }
        }
      }
    }
  });
  
  // Define grid regions (absolute Excel column numbers: C=3, D=4, E=5, F=6)
  const gridRegions = [
    { startRow: 6, endRow: 9, startCol: 2, endCol: 5 },    // B6:E9
    { startRow: 14, endRow: 22, startCol: 2, endCol: 5 },  // B14:E22
    { startRow: 24, endRow: 32, startCol: 2, endCol: 5 },  // B24:E31
    { startRow: 34, endRow: 35, startCol: 2, endCol: 5 },  // B33:E34
  ];
  
  const boldGridRows = [14, 22, 24, 32]; // Rows with bold borders
  
  const hasGrid = (row, col) => {
    return gridRegions.some(region =>
      row >= region.startRow && row <= region.endRow &&
      col >= region.startCol && col <= region.endCol
    );
  };
  
  const hasBoldGrid = (row) => boldGridRows.includes(row);
  
  // Start table with outer border (req #13)
  let html = '<table cellpadding="4" cellspacing="0" style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 10pt; border: 2px solid #000000;">';
  
  for (let r = startRow; r <= endRow; r++) {

    let rowStyle = '';
    if (r === 4 || r === 10 || r === 13 || r === 23 || r === 33 || r === 36 || r === 37 || r === 38 ||
        r === 41 || r === 42 || r === 43 || r === 44 || r === 45 ) {
      rowStyle = ' style="height: 21px;"';
    }
    
    html += `<tr${rowStyle}>`;
    
    for (let c = startCol; c <= endCol; c++) {
      if (skipCells.has(`${r},${c}`)) continue;
      
      const cell = sheet.getCell(r, c);
      let value = cell.value;
      
      // Handle rich text (req #5)
      if (value && typeof value === 'object' && value.richText) {
        value = value.richText.map(segment => {
          if (segment.font?.bold) {
            return `<strong>${segment.text}</strong>`;
          }
          return segment.text;
        }).join('');
      }
      // Handle formula results
      else if (value && typeof value === 'object') {
        if ('result' in value) {
          value = value.result;
        } else if ('formula' in value) {
          value = cell.text || '';
        } else {
          value = '';
        }
      }
      
      // Convert null/undefined to empty string
      if (value === null || value === undefined) {
        value = '';
      }
      
      // Handle dates
      if (value instanceof Date) {
        value = value.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      }
      
      // Handle numbers - round to remove decimals
      if (typeof value === 'number') {
        value = Math.round(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      }
      
      // Build cell style
      let style = 'padding: 4px 8px;';
      
      // Set column C width to 150px (req #11)
      if (c === 1) {
        style += ' width: 43px;';
      }
      
      if (c === 2) {
        style += ' width: 146px;';
      }

      if (c === 3) {
        style += ' width: 146px;';
      }

      if (c === 4) {
        style += ' width: 132px;';
      }

      if (c === 5) {
        style += ' width: 170px;';
      }
      
      if (c === 6) {
        style += ' width: 47px;';
      }

      // Apply grid borders
      const showGrid = hasGrid(r, c);
      const boldBorder = hasBoldGrid(r);
      
      if (showGrid) {
        const borderWidth = boldBorder ? '2px' : '1px';
        style += ` border: ${borderWidth} solid #000000;`;
      } else {
        style += ' border: none;';
      }
      
      if (cell.font?.bold) style += ' font-weight: bold;';
      if (cell.font?.size) style += ` font-size: ${cell.font.size}pt;`;
      
      // Special color for plotting company (req #3)
      if (r === 6 && c === 3) {
        style += ' color: #28577d;';
      }
      
      // White text for specific header cells (req #4)
      const headerCells = [
        { r: 6, c: 2 }, // EMPLOYEE INFORMATION
        { r: 6, c: 4 }, // PAY DATE
        { r: 6, c: 5 }, // PERIOD
        { r: 8, c: 4 }, // Employee ID
        { r: 8, c: 5 }, // PAY TYPE
      ];
      
      if (headerCells.some(h => h.r === r && h.c === c)) {
        style += ' color: #ffffff;';
      }
      
      if (cell.fill?.fgColor?.argb) {
        const color = cell.fill.fgColor.argb.slice(2);
        style += ` background-color: #${color};`;
      }
      
      if (cell.alignment?.horizontal) {
        style += ` text-align: ${cell.alignment.horizontal};`;
      }
      if (cell.alignment?.vertical) {
        style += ` vertical-align: ${cell.alignment.vertical};`;
      }
      
      const mergeInfo = mergedCells.get(`${r},${c}`);
      const rowspan = mergeInfo?.rowspan || 1;
      const colspan = mergeInfo?.colspan || 1;
      
      html += `<td style="${style}" rowspan="${rowspan}" colspan="${colspan}">${value}</td>`;
    }
    
    html += '</tr>';
  }
  
  html += '</table>';
  return html;
}

/**
 * Resolve the entity's payslip logo (from its policy) as a data URI, for
 * injection into the generated HTML. The final PDF is built by converting
 * cell VALUES to an HTML table (excelRangeToHtml) and rendering that with
 * Puppeteer — it never rasterizes the source XLSX, so an image embedded via
 * ExcelJS's addImage (workbook/sheet level) would be invisible here. The
 * logo has to be a real <img> in the HTML instead.
 *
 * Falls back silently (returns null) on any failure — a missing/broken
 * logo must never break payslip generation; the template's static header
 * text is left in place as the fallback.
 */
async function getPayslipLogoDataUri(plottingCompanyId) {
  try {
    const policy = await getEntityPolicy(plottingCompanyId);
    if (!policy.payslipLogoUrl) return null;

    const buffer = await getFileFromR2(policy.payslipLogoUrl);
    const mimeType = policy.payslipLogoUrl.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  } catch (err) {
    console.error('[Payslip] Failed to load custom logo, using template default:', err.message);
    return null;
  }
}

/**
 * Fill template with employee data and convert to PDF
 */
export const fillTemplateAndConvertToPDF = async (employeeData, payrollData, period, plottingCompany) => {
  // Load template
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);

  const sheet = workbook.getWorksheet('Payslip');
  if (!sheet) {
    throw new Error('Template sheet "Payslip" not found');
  }

  const logoDataUri = await getPayslipLogoDataUri(plottingCompany?.id);

  // ── Populate cells ─────────────────────────────────────────────────────────
  sheet.mergeCells('B2:D2');
  sheet.mergeCells('B3:D3');

  // A custom logo replaces the template's static "Rhaya Flicks" title (B1)
  // entirely, rather than rendering underneath/behind it. The address (B2)
  // and email (B3) lines are left as-is — they're a separate, pre-existing
  // limitation (hardcoded per-entity contact info), not part of this fix.
  if (logoDataUri) {
    sheet.getCell('B1').value = '';
  }

  sheet.getCell('B5').value = employeeData.plottingCompanyName || 'PT Rhayakan Film Indonesia';
  sheet.mergeCells('B5:C5');
  
  // Name and Role - merge with column D (req #1, #2)
  sheet.getCell('B7').value = employeeData.name;
  // sheet.mergeCells('C8:D8');
  
  sheet.getCell('B8').value = payrollData.position || '';
  // sheet.mergeCells('C9:D9');
  
  sheet.getCell('B9').value = employeeData.email;
  
  // Pay date with dd/mm/yy format (req #3)
  const payDate = period.payDate 
    ? new Date(period.payDate) 
    : new Date(period.year, period.month - 1, 28);
  
  const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };
  
  sheet.getCell('D7').value = formatDate(payDate);
  sheet.getCell('E7').value = `${MONTH_NAMES[period.month]} ${period.year}`;
  sheet.getCell('D9').value = employeeData.nip || employeeData.id;
  // console.log('PPh 21 Ter:', payrollData.pph21Ter);
  sheet.getCell('E9').value = payrollData.pph21Ter;
  sheet.getCell('E9').numFmt = '@';  // Text format
  
  // const leaveBalance = employeeData.annualRemaining + employeeData.toilBalance - employeeData.toilUsed;
  // sheet.getCell('D12').value = leaveBalance;
  
  // // Add "per dd/mm/yy" below "Sisa Cuti" (req #4)
  // sheet.getCell('C13').value = `per ${formatDate(payDate)}`;

  
  // Earnings
  sheet.getCell('C15').value = period.workdays || 20;
  sheet.getCell('D15').value = payrollData.basicPay;
  sheet.getCell('E15').value = payrollData.basicPay;

  const hours = employeeData.overtimeHours || 0;
  const formatted = hours % 1 === 0 ? hours.toString() : hours.toFixed(1);
  sheet.getCell('C16').value = formatted;
  sheet.getCell('C16').numFmt = '@';  // Text format
  sheet.getCell('D16').value = payrollData.overtimePay;
  sheet.getCell('E16').value = payrollData.overtimePay;
  
  // Zero out these fields (req #6)
  sheet.getCell('C17').value = 0; // Transportation
  sheet.getCell('C18').value = 0; // Commission and Bonus
  sheet.getCell('C19').value = 0; // Sick Pay
  sheet.getCell('C21').value = 0; // Others

  sheet.getCell('E17').value = 0; // Transportation
  sheet.getCell('E18').value = 0; // Commission and Bonus
  sheet.getCell('E19').value = 0; // Sick Pay
  sheet.getCell('E21').value = 0; // Others
  
  // C17 - Prepaid Expense with bold "Prepaid Expense From:" (req #5)
  sheet.getCell('B17').value = {
    richText: [
      { font: { bold: true }, text: 'Prepaid Expense From:' },
      { text: ' THR: Bonus: Overtime' }
    ]
  };
  const prepaidTotal = (payrollData.prepaidTHR || 0) +
                        (payrollData.bdd || 0);

  sheet.getCell('D17').value = prepaidTotal;
  sheet.getCell('E17').value = prepaidTotal;

  // Health & Wellness
  const healthWellness = (payrollData.bpjskesEmployer || 0) + 
                         (payrollData.aiaBill || 0) + 
                         (payrollData.jkk || 0) + 
                         (payrollData.jkm || 0);
  sheet.getCell('D20').value = healthWellness;
  sheet.getCell('E20').value = healthWellness;

  // Gross Earnings
  // sheet.getCell('E22').value = (payrollData.basicPay + payrollData.overtimePay + healthWellness + payrollData.bdd);
  sheet.getCell('E22').value = payrollData.grossPay; // Use gross pay from Excel to ensure consistency with template calculations 
  
  // Deductions
  sheet.getCell('C25').value = `${payrollData.pph21Percentage.toFixed(2)}%`;
  sheet.getCell('C25').numFmt = '@';                    // Text format
  sheet.getCell('D25').value = payrollData.pph21Adjust; // AG column (adjust)
  sheet.getCell('E25').value = payrollData.pph21Adjust; // AG column (adjust)
  
  sheet.getCell('C26').value = "2.00%";
  sheet.getCell('D26').value = payrollData.bpjstk;      // Column T
  sheet.getCell('E26').value = payrollData.bpjstk;      // Column T
  
  sheet.getCell('C27').value = "1.00%";
  sheet.getCell('D27').value = payrollData.bpjskes;     // Column U
  sheet.getCell('E27').value = payrollData.bpjskes;     // Column U
  
  sheet.getCell('C28').value = "0.00%";
  sheet.getCell('D28').value = payrollData.famInsurance;  
  sheet.getCell('E28').value = payrollData.famInsurance;
  
  sheet.getCell('C29').value = "0.00%";
  sheet.getCell('D29').value = payrollData.employeeLoan;  
  sheet.getCell('E29').value = payrollData.employeeLoan;

  sheet.getCell('C30').value = "0.00%";
  sheet.getCell('D30').value = payrollData.othersDeduction;  
  sheet.getCell('E30').value = payrollData.othersDeduction;

  sheet.getCell('C31').value = "0.00%";
  const kompensasiA1 = payrollData.kompensasiA1 || 0;
  const formatted_kompensasiA1 = kompensasiA1 >= 0 
    ? kompensasiA1.toLocaleString('en-US') 
    : "(" + Math.abs(kompensasiA1).toLocaleString('en-US') + ")";
  sheet.getCell('D31').value = formatted_kompensasiA1;  
  sheet.getCell('E31').value = formatted_kompensasiA1;
  sheet.getCell('E32').value = (payrollData.pph21Adjust + payrollData.bpjstk + payrollData.bpjskes + payrollData.kompensasiA1 + payrollData.famInsurance + payrollData.employeeLoan + payrollData.othersDeduction);     // Column F

  // Take Home Pay
  // sheet.getCell('E34').value = ((payrollData.basicPay + payrollData.overtimePay) - 
  //                               (payrollData.pph21Adjust + payrollData.bpjstk + payrollData.bpjskes + payrollData.kompensasiA1 + payrollData.famInsurance + payrollData.employeeLoan + payrollData.othersDeduction)); // Recalculate net pay to ensure consistency with deductions
  sheet.getCell('E34').value = payrollData.netPay; // Use net pay from Excel to ensure consistency with template calculations

  // ── Convert to HTML ────────────────────────────────────────────────────────
  const htmlTable = await excelRangeToHtml(sheet, 'A1:F49');

  // Logo sits over column B (where the static "Rhaya Flicks" title, cell B1,
  // otherwise renders), not flush against the left edge (column A). The
  // rendered table has no fixed column widths (auto-layout), so this is an
  // approximation of column A's width (5.5 Excel units ≈ 11.7mm) rather than
  // a pixel-exact match — good enough since column A is just a narrow margin.
  const logoHtml = logoDataUri
    ? `<img src="${logoDataUri}" alt="Company logo" style="position: absolute; top: 0; left: 11.7mm; max-height: 50px; max-width: 160px; object-fit: contain;" />`
    : '';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @page {
          size: A4;
          margin: 15mm;
        }
        body {
          margin: 0;
          padding: 0;
          width: 210mm;  /* A4 width */
          position: relative;
        }
        table {
          width: 100%;
          page-break-inside: avoid;
        }
      </style>
    </head>
    <body>${logoHtml}${htmlTable}</body>
    </html>
  `;
  
  // ── Convert HTML to PDF ────────────────────────────────────────────────────
  const options = { 
    format: 'A4',
    printBackground: true,
    margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
  };
  
  const file = { content: htmlContent };
  const pdfBuffer = await htmlPdf.generatePdf(file, options);
  
  return pdfBuffer;
};

// ─── Preview Function ─────────────────────────────────────────────────────────

/**
 * Generate preview from Excel with sheet selection
 */
export const generatePayslipsPreviewWithTemplate = async (excelBuffer, sheetName, period, plottingCompanyId) => {
  const results = { employees: [], failed: [] };
  
  const payrollRows = await parsePayrollSheet(excelBuffer, sheetName);
  
  if (payrollRows.length === 0) {
    throw new Error(`No employee data found in sheet "${sheetName}" (starting row 10)`);
  }
  
  const dbEmployees = await prisma.user.findMany({
    where: { employeeStatus: { not: 'INACTIVE' } },
    select: {
      id: true,
      name: true,
      email: true,
      nip: true,
      nik: true,
      dateOfBirth: true,
      overtimeRate: true,  
      plottingCompany: { 
        select: { 
          id: true,
          name: true, 
          code: true  
        } 
      },
      leaveBalances: {
        select: { annualRemaining: true, toilBalance: true, toilUsed: true },
        orderBy: { year: 'desc' },
        take: 1,
      },
      overtimeRecaps: {  
        where: {
          year: period.year,
          month: period.month
        },
        select: {
          totalHours: true,
          paidHours: true
        },
        take: 1
      }
    },
  });

  // Fetch the selected plotting company details
  const selectedCompany = await prisma.plottingCompany.findUnique({
    where: { id: plottingCompanyId },
    select: { id: true, code: true, name: true }
  });

  if (!selectedCompany) {
    throw new Error('Selected plotting company not found');
  }
  
  const nikMap = new Map();
  for (const emp of dbEmployees) {
    if (emp.nik) nikMap.set(String(emp.nik).trim(), emp);
  }
  
  for (const row of payrollRows) {
    if (!row.nik) {
      results.failed.push({ nik: row.nik, reason: 'NIK is empty' });
      continue;
    }
    
    const employee = nikMap.get(row.nik);
    if (!employee) {
      results.failed.push({ nik: row.nik, reason: `No employee found with NIK ${row.nik}` });
      continue;
    }
    
    if (!employee.dateOfBirth) {
      results.failed.push({
        name: employee.name,
        nik: row.nik,
        reason: 'Date of birth missing — required for encryption',
      });
      continue;
    }
    
    try {
      const leaveData = employee.leaveBalances?.[0];

      const overtimeRecap = employee.overtimeRecaps?.[0];
  
      // Calculate overtime hours from payment and rate
      // Formula: overtimeHours = overtimePayment / (overtimeRate * 8)
      const overtimeRate = parseFloat(employee.overtimeRate || 0);
      const overtimePayment = row.overtimePay || 0;
      
      let calculatedOvertimeHours = 0;
      if (overtimeRate > 0 && overtimePayment > 0) {
        const hourlyRate = overtimeRate / 8;
        calculatedOvertimeHours = overtimePayment / hourlyRate;
      }
      
      // Get actual overtime hours from DB
      const dbOvertimeHours = overtimeRecap?.paidHours || 0;
      
      // Check for mismatch (allow 0.5 hour difference for rounding)
      const overtimeMismatch = Math.abs(calculatedOvertimeHours - dbOvertimeHours) > 0.5;
      
      const pdfBuffer = await fillTemplateAndConvertToPDF({
        id: employee.id,
        name: employee.name,
        email: employee.email,
        nip: employee.nip,
        plottingCompanyName: selectedCompany.name,
        annualRemaining: leaveData?.annualRemaining || 0,
        toilBalance: leaveData?.toilBalance || 0,
        toilUsed: leaveData?.toilUsed || 0,
        overtimeHours: dbOvertimeHours,
      }, row, period, selectedCompany);
      
      // Validate deductions
      const calculatedNet = (row.basicPay + row.overtimePay) - 
                           (row.pph21Adjust + row.bpjstk + row.bpjskes + row.kompensasiA1 + row.famInsurance + row.employeeLoan + row.othersDeduction);
      const deductionMismatch = Math.abs(calculatedNet - row.netPay) > 1; // Allow 1 IDR rounding difference
      
      // Format as IDR (req #15)
      const formatIDR = (amount) => {
        return new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(Math.round(amount));
      };
      
      console.log(`Employee ${employee.name} plotting company: ${employee.plottingCompany?.name || 'N/A'}, Selected company: ${selectedCompany.name}`),
      
      results.employees.push({
          employeeId: employee.id,
          name: employee.name,
          nik: row.nik,
          email: employee.email,
          position: row.position,
          plottingCompanyId: selectedCompany.id,
          plottingCompanyCode: selectedCompany.code,
          plottingCompanyName: selectedCompany.name,
          employeeDbCompanyId: employee.plottingCompany?.id,
          employeeDbCompanyCode: employee.plottingCompany?.code,
          employeeDbCompanyName: employee.plottingCompany?.name,
          companyMismatch: employee.plottingCompany?.id !== selectedCompany.id,
          overtimeHoursDb: dbOvertimeHours,
          overtimeHoursCalculated: calculatedOvertimeHours,
          overtimeMismatch: overtimeMismatch,
          overtimePayment: overtimePayment,
          overtimeRate: overtimeRate,
          grossPay: row.grossPay,
          netPay: row.netPay,
          grossPayFormatted: formatIDR(row.grossPay),
          netPayFormatted: formatIDR(row.netPay),
          pdfBase64: pdfBuffer.toString('base64'),
          checked: true,
          deductionWarning: deductionMismatch ? `Net Pay mismatch: Calculated: ${formatIDR(calculatedNet)} | Payslip: ${formatIDR(row.netPay)}` : null,
        });
      
    } catch (err) {
      console.error(`Failed to generate for ${employee.name}:`, err.message);
      results.failed.push({ name: employee.name, nik: row.nik, reason: err.message });
    }
  }
  
  console.log(
    `Preview complete: ${results.employees.length} generated, ${results.failed.length} failed`
  );
  
  return results;
};

// ─── Confirm & Upload Function ────────────────────────────────────────────────

export const confirmAndUploadPayslips = async (
  selectedEmployees,
  period,
  uploadedById,
  sendNotifications = true
) => {
  const results = { success: [], failed: [] };
  
  const employeeIds = selectedEmployees.map(e => e.employeeId);
  const dbEmployees = await prisma.user.findMany({
    where: { id: { in: employeeIds } },
    select: {
      id: true,
      name: true,
      email: true,
      dateOfBirth: true,
      employeeStatus: true,
    },
  });
  
  const employeeMap = new Map(dbEmployees.map(e => [e.id, e]));
  
  for (const item of selectedEmployees) {
    const employee = employeeMap.get(item.employeeId);
    if (!employee) {
      results.failed.push({ employeeId: item.employeeId, reason: 'Employee not found' });
      continue;
    }
    
    if (!employee.dateOfBirth) {
      results.failed.push({
        employeeId: item.employeeId,
        name: employee.name,
        reason: 'Date of birth missing',
      });
      continue;
    }
    
    // Validate plottingCompanyId is provided
    if (!item.plottingCompanyId) {
      results.failed.push({
        employeeId: item.employeeId,
        name: employee.name,
        reason: 'Plotting company ID missing',
      });
      continue;
    }
    
    try {
      const pdfBuffer = Buffer.from(item.pdfBase64, 'base64');
      const encryptedBuffer = await encryptPayslipPDF(pdfBuffer, employee.dateOfBirth);
      
      // Generate filename format ie."RFI - Payslip Muhammad Harun A. - February 2026.pdf"
      const filename = generatePayslipFilename(
        employee.name,
        item.plottingCompanyCode,
        period
      );
      
      const r2Key = await uploadPayslip(encryptedBuffer, employee.id, period.year, period.month, filename);
      
      const existing = await prisma.payslip.findUnique({
        where: {
          employeeId_year_month_plottingCompanyId: {
            employeeId: employee.id,
            year: period.year,
            month: period.month,
            plottingCompanyId: item.plottingCompanyId, // NEW: Include in unique check
          },
        },
      });
      
      const payslipData = {
        fileName: filename,
        fileUrl: r2Key,
        fileSize: encryptedBuffer.length,
        grossSalary: item.grossPay || null,
        netSalary: item.netPay || null,
        notes: `Generated from Excel template — ${MONTH_NAMES[period.month]} ${period.year}`,
        uploadedById,
        uploadedAt: new Date(),
        plottingCompanyId: item.plottingCompanyId, // NEW: Save plotting company
      };
      
      let payslip;
      if (existing) {
        payslip = await prisma.payslip.update({
          where: { id: existing.id },
          data: payslipData,
        });
      } else {
        payslip = await prisma.payslip.create({
          data: {
            employeeId: employee.id,
            year: period.year,
            month: period.month,
            ...payslipData,
          },
        });
      }
      
      if (sendNotifications && employee.employeeStatus !== 'Inactive') {
        try {
          await sendPayslipNotificationEmail(employee, { 
            year: period.year, 
            month: period.month,
            plottingCompanyName: item.plottingCompanyName, // NEW: Include company in email
          });
        } catch (emailErr) {
          console.warn(`Email failed for ${employee.name}:`, emailErr.message);
        }
      }
      
      results.success.push({
        employeeId: employee.id,
        name: employee.name,
        payslipId: payslip.id,
        emailSent: sendNotifications,
      });
      
    } catch (err) {
      console.error(`Upload failed for ${employee.name}:`, err.message);
      results.failed.push({ employeeId: employee.id, name: employee.name, reason: err.message });
    }
  }
  
  console.log(`Upload complete: ${results.success.length} uploaded, ${results.failed.length} failed`);
  
  return results;
};

/**
 * Detect plotting company from first employee in the sheet
 * Used to recommend which company this payroll data is for
 */
export const detectPlottingCompanyFromSheet = async (excelBuffer, sheetName) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(excelBuffer);
  
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }

  // Find first employee (row 10+)
  let firstEmployeeNIK = null;
  
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < 10) return;
    if (firstEmployeeNIK) return; // Already found
    
    const name = row.getCell('B').value;
    if (!name || typeof name !== 'string') return;
    
    const nikCell = row.getCell('E').value;
    firstEmployeeNIK = String(nikCell || '').trim();
  });

  if (!firstEmployeeNIK) {
    return null; // No employee found
  }

  // Fetch employee from DB to get their plotting company
  const employee = await prisma.user.findFirst({
    where: { 
      nik: firstEmployeeNIK,
      employeeStatus: { not: 'Inactive' }
    },
    select: {
      id: true,
      name: true,
      nik: true,
      plottingCompany: {
        select: {
          id: true,
          code: true,
          name: true
        }
      }
    }
  });

  if (!employee || !employee.plottingCompany) {
    return null;
  }

  return {
    employeeName: employee.name,
    nik: employee.nik,
    plottingCompany: employee.plottingCompany
  };
};