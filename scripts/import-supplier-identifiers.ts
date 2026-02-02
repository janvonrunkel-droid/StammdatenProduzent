/**
 * Import-Script für Lieferanten-Merkmale aus CSV
 *
 * Verwendung:
 * 1. npx ts-node scripts/import-supplier-identifiers.ts
 * 2. Oder: npx tsx scripts/import-supplier-identifiers.ts
 */

// CSV-Daten (aus Export)
const csvData = `merkmal_typ,merkmal_wert,operator,lieferant,priorität,aktiv
rechnungsnummer,KRE,contains,Bauen und Leben,Hoch,TRUE
email,bauenundleben.com,contains,Bauen und Leben,Mittel,TRUE
telefon,2151 4878,contains,Bauen und Leben,Hoch,TRUE
text,Systembetrieb Krefeld,contains,Bauen und Leben,Mittel,TRUE
text,"LKA,BREGAL",contains,Bauen und Leben,Niedrig,TRUE
text,"LKA,BREHAU",contains,Bauen und Leben,Niedrig,TRUE
rechnungsnummer,KFZ 40-,contains,Württembergische Versicherung,Hoch,TRUE
email,wuerttembergische.de,contains,Württembergische Versicherung,Mittel,TRUE
telefon,0711 662,contains,Württembergische Versicherung,Hoch,TRUE
text,SF-Klasse,contains,Württembergische Versicherung,Mittel,TRUE
text,www.jean-berends.de,contains,Jean Berends,Hoch,TRUE
text,Abfälle,contains,Jean Berends,Mittel,TRUE
text,Absetzcontainer,contains,Jean Berends,Hoch,TRUE
text,josef-brocker-dyk,contains,Bauunternehmung Joachim Groß,Hoch,TRUE
text,gross.krefeld@outlook.de,contains,Bauunternehmung Joachim Groß,Hoch,TRUE
steuernummer,12/345/67890,equals,Finanzamt,Hoch,FALSE`;

// API Base URL
const API_BASE = process.env.API_URL || 'https://stammdaten-produzent.vercel.app';

interface Supplier {
  id: string;
  name: string;
}

interface IdentifierInput {
  supplier_id: string;
  identifier_type: string;
  identifier_value: string;
  operator: string;
  priority: string;
  is_active: boolean;
}

// Parse CSV
function parseCSV(csv: string): Array<Record<string, string>> {
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());

  const results: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Handle quoted values with commas
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    results.push(row);
  }

  return results;
}

// Map priority
function mapPriority(p: string): string {
  const mapping: Record<string, string> = {
    'Hoch': 'hoch',
    'Mittel': 'mittel',
    'Niedrig': 'niedrig',
  };
  return mapping[p] || 'mittel';
}

async function main() {
  console.log('🚀 Starte Import der Lieferanten-Merkmale...\n');

  // 1. Parse CSV
  const rows = parseCSV(csvData);
  console.log(`📄 ${rows.length} Zeilen aus CSV gelesen\n`);

  // 2. Sammle eindeutige Lieferantennamen
  const supplierNames = [...new Set(rows.map(r => r.lieferant).filter(Boolean))];
  console.log(`👥 Benötigte Lieferanten: ${supplierNames.join(', ')}\n`);

  // 3. Info-Output für manuellen Import
  console.log('═══════════════════════════════════════════════════════');
  console.log('IMPORT-DATEN (für manuellen Import oder API-Call):');
  console.log('═══════════════════════════════════════════════════════\n');

  // Gruppiere nach Lieferant
  const bySupplier: Record<string, typeof rows> = {};
  for (const row of rows) {
    if (!row.lieferant || !row.merkmal_typ) continue;
    if (!bySupplier[row.lieferant]) {
      bySupplier[row.lieferant] = [];
    }
    bySupplier[row.lieferant].push(row);
  }

  for (const [supplier, identifiers] of Object.entries(bySupplier)) {
    console.log(`\n📦 ${supplier} (${identifiers.length} Merkmale):`);
    console.log('─'.repeat(50));

    if (identifiers.length > 5) {
      console.log(`   ⚠️  WARNUNG: Mehr als 5 Merkmale! Max. 5 erlaubt.`);
    }

    for (const id of identifiers) {
      const isActive = id.aktiv === 'TRUE';
      const priority = mapPriority(id['priorität'] || id.prioritaet || 'Mittel');

      console.log(`   • [${id.merkmal_typ}] "${id.merkmal_wert}" (${id.operator}, ${priority})${!isActive ? ' [INAKTIV]' : ''}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('SQL INSERT STATEMENTS:');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log(`-- Zuerst die Lieferanten-IDs ermitteln:`);
  console.log(`-- SELECT id, name FROM suppliers WHERE name IN (${supplierNames.map(n => `'${n}'`).join(', ')});\n`);

  console.log(`-- Dann die Merkmale einfügen (supplier_id ersetzen!):`);

  for (const row of rows) {
    if (!row.lieferant || !row.merkmal_typ) continue;

    const isActive = row.aktiv === 'TRUE';
    const priority = mapPriority(row['priorität'] || row.prioritaet || 'Mittel');
    const value = row.merkmal_wert.replace(/'/g, "''"); // Escape single quotes

    console.log(`INSERT INTO supplier_identifiers (supplier_id, identifier_type, identifier_value, operator, priority, is_active)`);
    console.log(`VALUES ((SELECT id FROM suppliers WHERE name = '${row.lieferant}'), '${row.merkmal_typ}', '${value}', '${row.operator}', '${priority}', ${isActive});`);
    console.log('');
  }

  console.log('\n✅ Script abgeschlossen!');
  console.log('\nNächste Schritte:');
  console.log('1. Prüfe ob alle Lieferanten in der DB existieren');
  console.log('2. Führe die SQL-Statements in Supabase SQL Editor aus');
  console.log('3. Oder: Nutze die App-UI unter /settings/supplier-identifiers');
}

main().catch(console.error);
