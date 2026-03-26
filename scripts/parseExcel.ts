import { readFileSync } from 'fs';
import { read, utils } from 'xlsx';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'attached_assets', 'MA_BENEFITS_REPORT_20250516_1765500234874.xlsb');

console.log('Reading Excel file:', filePath);
console.log('Starting parse...');

const buf = readFileSync(filePath);
console.log('File read into buffer, size:', buf.length, 'bytes');

const workbook = read(buf, { sheetRows: 10 });
console.log('Workbook parsed (first 10 rows only)');

console.log('\n=== Sheet Names ===');
console.log(workbook.SheetNames);

for (const sheetName of workbook.SheetNames) {
  console.log(`\n=== Sheet: ${sheetName} ===`);
  const sheet = workbook.Sheets[sheetName];
  const data = utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  
  console.log('Sample rows:', data.length);
  
  if (data.length > 0) {
    console.log('\n--- Headers (Row 1) ---');
    console.log(JSON.stringify(data[0], null, 2));
    
    if (data.length > 1) {
      console.log('\n--- Sample Data (Row 2) ---');
      console.log(JSON.stringify(data[1], null, 2));
    }
  }
}
