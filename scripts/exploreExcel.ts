import { readFileSync } from 'fs';
import { read, utils } from 'xlsx';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'attached_assets', 'MA_BENEFITS_REPORT_20250516_1765500234874.xlsb');

console.log('Exploring Excel file structure...');

const buf = readFileSync(filePath);
const workbook = read(buf, { sheetRows: 20 });

console.log('Sheet names:', workbook.SheetNames);

for (const sheetName of workbook.SheetNames) {
  console.log(`\n=== Sheet: ${sheetName} ===`);
  const sheet = workbook.Sheets[sheetName];
  
  const rawData = utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  
  console.log(`Rows loaded: ${rawData.length}`);
  
  for (let i = 0; i < Math.min(rawData.length, 5); i++) {
    const row = rawData[i];
    if (row && row.length > 0) {
      const firstCells = row.slice(0, 15);
      console.log(`Row ${i}: ${JSON.stringify(firstCells)}`);
    }
  }
}
