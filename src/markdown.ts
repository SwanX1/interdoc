import type { Documentation, PropertyDocumentation, InterfaceDocumentation, TypeDocumentation, Type } from "./extract";
import { log } from "./logger";

export function preprocessForMarkdown(docs: Documentation[]): Record<string, Documentation> {
  const linked: Record<string, Documentation> = {};

  for (const doc of docs) {
    if ('type' in doc) {
      linked[doc.name] = {
        ...doc,
        type: deformatLiterals(doc.type),
      };
    } else {
      const properties: PropertyDocumentation[] = [];

      for (const property of doc.properties) {
        properties.push({
          ...property,
          optional: property.optional ?? false,
          type: deformatLiterals(property.type),
        });
      }

      linked[doc.name] = {
        ...doc,
        properties,
      };
    }
  }

  for (const doc of docs) {
    const linkedDoc = linked[doc.name];

    if ('type' in linkedDoc) {
      for (const type of linkedDoc.type.types.filter(type => !linked[type])) {
        log(`WARNING: Could not resolve type link for ${doc.name}: ${type}`);
      }
    } else {
      for (const property of linkedDoc.properties) {
        for (const type of property.type.types.filter(type => !linked[type])) {
          log(`WARNING: Could not resolve type link for ${doc.name}.${property.name}: ${type}`);
        }
      }
    }
  }

  return linked;
}

export function generateMarkdown(docs: Record<string, Documentation>, format: 'tables' | 'json'): string {
  let out = '';

  for (const [name, doc] of Object.entries(docs)) {
    out += `\n## ${name}\n`;
    out += doc.description ? `${doc.description}  \n` : '';

    if ('type' in doc) {
      out += `Type: ${formatType(doc.type)}\n`;
    } else {
      if (format === 'tables') {
        log(`Generating table for ${name}`);
        out += generateTable(doc);
      } else {
        log(`Generating JSON for ${name}`);
        out += generateJSON(doc);
      }
    }

    out += doc.example ? `\nExample: \n${doc.example}` : '';
  }

  return out;
}

function generateTable(doc: InterfaceDocumentation): string {
  let out = '';

  const minLineLength = {
    property: 'Property'.length,
    type: 'Type'.length,
    optional: 'Optional'.length,
    default: 'Default'.length,
    description: 'Description'.length,
    example: 'Example'.length,
  };

  for (const property of doc.properties) {
    minLineLength.property = Math.max(minLineLength.property, property.name.length);
    minLineLength.type = Math.max(minLineLength.type, formatType(property.type).length);
    minLineLength.optional = Math.max(minLineLength.optional, String(property.optional).length);
    minLineLength.default = Math.max(minLineLength.default, (property.default ?? '').length);
    minLineLength.description = Math.max(minLineLength.description, (property.description ?? '').length);
    minLineLength.example = Math.max(minLineLength.example, (property.example ?? '').length);
  }

  out += `| ${'Property'.padEnd(minLineLength.property)} | ${'Type'.padEnd(minLineLength.type)} | ${'Optional'.padEnd(minLineLength.optional)} | ${'Default'.padEnd(minLineLength.default)} | ${'Description'.padEnd(minLineLength.description)} | ${'Example'.padEnd(minLineLength.example)} |\n`;
  out += `| ${'-'.repeat(minLineLength.property)} | ${'-'.repeat(minLineLength.type)} | ${'-'.repeat(minLineLength.optional)} | ${'-'.repeat(minLineLength.default)} | ${'-'.repeat(minLineLength.description)} | ${'-'.repeat(minLineLength.example)} |\n`;

  for (const property of doc.properties) {
    out += `| ${property.name.padEnd(minLineLength.property)} | ${formatType(property.type).padEnd(minLineLength.type)} | ${(property.optional ? 'Yes' : 'No').padEnd(minLineLength.optional)} | ${(property.default ?? '-').padEnd(minLineLength.default)} | ${(property.description ?? '').padEnd(minLineLength.description)} | ${(property.example ?? '').padEnd(minLineLength.example)} |\n`;
  }

  return out;
}

function generateJSON(doc: InterfaceDocumentation): string {
  let out = '';

  out += '<pre>\n';
  out += `{\n`;

  for (const property of doc.properties) {
    if (property.description || property.default || property.example) {
      if (property.description) {
        out += property.description.split('\n').map(line => `  // ${line}`).join('\n') + '\n';
      }
      if (property.default) {
        out += `  // Defaults to: ${property.default}\n`;
      }
      if (property.example) {
        out += `  // Example: ${property.example}\n`;
      }
    }

    out += `  <strong>${property.name}</strong>${property.optional ? '?' : ''}: ${formatType(property.type, true)},\n`;
  }

  out += `}\n`;
  out += '</pre>\n';

  return out;
}

function formatType(type: Type, useHTML = false): string {
  let out = type.format;

  while (type.types.length > 0) {
    out = out.replace('{}', createLink(type.types.shift()!, useHTML));
  }

  return out;
}

function createLink(name: string, useHTML = false): string {
  return useHTML ? `<a href="#${name}">${name}</a>` : `[${name}](#${name})`;
}

function deformatLiterals(type: Type): Type {
  let newFormat = type.format;
  let unusedTypes: string[] = [];

  while (type.types.length > 0) {
    const literal = type.types.shift()!;
    if (['string', 'number', 'boolean'].includes(literal) || literal.startsWith('"') || literal.startsWith("'")) {
      newFormat = newFormat.replace('{}', literal);
    } else {
      unusedTypes.push(literal);
    }
  }

  return {
    types: unusedTypes,
    format: newFormat,
  };
}