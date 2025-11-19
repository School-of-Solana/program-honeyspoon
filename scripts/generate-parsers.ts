#!/usr/bin/env ts-node
/**
 * Parser Generator
 * 
 * Generates TypeScript account parsers from Rust struct definitions.
 * This ensures frontend parsers always match the on-chain account layout.
 * 
 * Usage: npm run generate-parsers
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Type mappings from Rust to TypeScript
const TYPE_MAPPINGS: Record<string, { tsType: string; size: number; parser: string }> = {
  'Pubkey': { tsType: 'PublicKey', size: 32, parser: 'new PublicKey(data.slice(offset, offset + 32))' },
  'u8': { tsType: 'number', size: 1, parser: 'data.readUInt8(offset)' },
  'u16': { tsType: 'number', size: 2, parser: 'data.readUInt16LE(offset)' },
  'u32': { tsType: 'number', size: 4, parser: 'data.readUInt32LE(offset)' },
  'u64': { tsType: 'BN', size: 8, parser: 'new BN(data.slice(offset, offset + 8), "le")' },
  'bool': { tsType: 'boolean', size: 1, parser: 'data.readUInt8(offset) === 1' },
  '[u8; 32]': { tsType: 'Buffer', size: 32, parser: 'data.slice(offset, offset + 32)' },
  'SessionStatus': { tsType: 'SessionStatus', size: 1, parser: 'parseSessionStatus(data.readUInt8(offset))' },
};

interface Field {
  name: string;
  rustType: string;
  tsType: string;
  size: number;
  parser: string;
  comment?: string;
}

interface StructDef {
  name: string;
  fields: Field[];
  hasEnum?: boolean;
  enumName?: string;
}

/**
 * Parse Rust struct definition from source code
 */
function parseRustStruct(source: string, structName: string): StructDef | null {
  // Find the struct definition
  const structRegex = new RegExp(
    `pub struct ${structName}\\s*\\{([^}]+)\\}`,
    's'
  );
  const match = source.match(structRegex);
  
  if (!match) {
    console.warn(`Struct ${structName} not found`);
    return null;
  }

  const structBody = match[1];
  const fields: Field[] = [];

  // Parse each field
  const fieldRegex = /pub\s+(\w+):\s*([^,]+),?\s*(?:\/\/\s*(.+))?/g;
  let fieldMatch: RegExpExecArray | null;

  while ((fieldMatch = fieldRegex.exec(structBody)) !== null) {
    const [, fieldName, rustType, comment] = fieldMatch;
    const cleanType = rustType.trim();
    
    const mapping = TYPE_MAPPINGS[cleanType];
    if (!mapping) {
      console.warn(`Unknown type: ${cleanType} for field ${fieldName}`);
      continue;
    }

    fields.push({
      name: fieldName,
      rustType: cleanType,
      tsType: mapping.tsType,
      size: mapping.size,
      parser: mapping.parser,
      comment: comment?.trim(),
    });
  }

  return { name: structName, fields };
}

/**
 * Parse enum definition
 */
function parseRustEnum(source: string, enumName: string): string[] | null {
  const enumRegex = new RegExp(
    `pub enum ${enumName}\\s*\\{([^}]+)\\}`,
    's'
  );
  const match = source.match(enumRegex);
  
  if (!match) return null;

  const enumBody = match[1];
  const variants = enumBody
    .split(',')
    .map(v => v.trim())
    .filter(v => v && !v.startsWith('//'));

  return variants;
}

/**
 * Generate TypeScript interface
 */
function generateInterface(struct: StructDef): string {
  let code = `/**\n * ${struct.name} account data\n`;
  code += ` * Matches: pub struct ${struct.name} in states.rs\n`;
  code += ` * AUTO-GENERATED - DO NOT EDIT MANUALLY\n */\n`;
  code += `export interface ${struct.name}Account {\n`;

  for (const field of struct.fields) {
    const camelName = snakeToCamel(field.name);
    if (field.comment) {
      code += `  ${camelName}: ${field.tsType}; // ${field.comment}\n`;
    } else {
      code += `  ${camelName}: ${field.tsType};\n`;
    }
  }

  code += `}\n`;
  return code;
}

/**
 * Generate parser function
 */
function generateParser(struct: StructDef): string {
  let code = `/**\n * Parse ${struct.name} account data\n`;
  code += ` * AUTO-GENERATED - DO NOT EDIT MANUALLY\n`;
  code += ` *\n * Layout:\n`;
  
  let offset = 8; // discriminator
  code += ` * - [0..8]    discriminator (8 bytes)\n`;
  
  for (const field of struct.fields) {
    const end = offset + field.size;
    const byteRange = `[${offset}..${end}]`.padEnd(10);
    code += ` * - ${byteRange} ${field.name} (${field.rustType}, ${field.size} byte${field.size > 1 ? 's' : ''})\n`;
    offset = end;
  }
  
  code += ` */\n`;
  code += `export function parse${struct.name}Data(\n`;
  code += `  dataInput: Uint8Array | Buffer\n`;
  code += `): ${struct.name}Account {\n`;
  code += `  const data = Buffer.from(dataInput);\n`;
  code += `  let offset = 8; // skip discriminator\n\n`;

  for (const field of struct.fields) {
    const camelName = snakeToCamel(field.name);
    code += `  const ${camelName} = ${field.parser};\n`;
    code += `  offset += ${field.size};\n\n`;
  }

  code += `  return {\n`;
  for (const field of struct.fields) {
    const camelName = snakeToCamel(field.name);
    code += `    ${camelName},\n`;
  }
  code += `  };\n`;
  code += `}\n`;

  return code;
}

/**
 * Generate enum type
 */
function generateEnum(enumName: string, variants: string[]): string {
  let code = `/**\n * ${enumName} enum - matches contract\n`;
  code += ` * AUTO-GENERATED - DO NOT EDIT MANUALLY\n */\n`;
  code += `export type ${enumName} = ${variants.map(v => `"${v}"`).join(' | ')};\n\n`;
  
  // Helper functions
  code += `export function parse${enumName}(variant: number): ${enumName} {\n`;
  code += `  switch (variant) {\n`;
  variants.forEach((v, i) => {
    code += `    case ${i}: return "${v}";\n`;
  });
  code += `    default: throw new Error(\`Unknown ${enumName} variant: \${variant}\`);\n`;
  code += `  }\n`;
  code += `}\n\n`;

  code += `export function ${enumName}ToVariant(status: ${enumName}): number {\n`;
  code += `  switch (status) {\n`;
  variants.forEach((v, i) => {
    code += `    case "${v}": return ${i};\n`;
  });
  code += `    default: throw new Error(\`Unknown ${enumName}: \${status}\`);\n`;
  code += `  }\n`;
  code += `}\n`;

  return code;
}

/**
 * Convert snake_case to camelCase
 */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Main generator
 */
function generateParsers() {
  console.log('🔧 Generating TypeScript parsers from Rust structs...\n');

  const rustSource = fs.readFileSync(
    path.join(__dirname, '../anchor_project/the_fool/programs/dive_game/src/states.rs'),
    'utf-8'
  );

  const outputPath = path.join(__dirname, '../frontend/the_fool/lib/ports/solanaParsers.generated.ts');

  let output = `/**
 * AUTO-GENERATED Solana Account Data Parsers
 * 
 * Generated from: anchor_project/the_fool/programs/dive_game/src/states.rs
 * DO NOT EDIT THIS FILE MANUALLY - Run 'npm run generate-parsers' instead
 * 
 * This ensures frontend parsers always match on-chain account layouts.
 */

import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

`;

  // Generate SessionStatus enum
  const sessionStatusVariants = parseRustEnum(rustSource, 'SessionStatus');
  if (sessionStatusVariants) {
    output += generateEnum('SessionStatus', sessionStatusVariants);
    output += '\n';
  }

  // Generate structs
  const structs = ['HouseVault', 'GameConfig', 'GameSession'];
  
  for (const structName of structs) {
    const struct = parseRustStruct(rustSource, structName);
    if (!struct) {
      console.error(`❌ Failed to parse ${structName}`);
      continue;
    }

    console.log(`✅ Parsed ${structName} (${struct.fields.length} fields)`);
    
    output += generateInterface(struct);
    output += '\n';
    output += generateParser(struct);
    output += '\n';
  }

  fs.writeFileSync(outputPath, output);
  console.log(`\n✅ Generated parsers: ${outputPath}`);
  console.log('\n💡 Import from: lib/ports/solanaParsers.generated');
}

// Run generator
generateParsers();
