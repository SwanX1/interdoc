import type { Documentation } from "./extract";

export type LinkedDocumentation = LinkedInterfaceDocumentation | LinkedTypeDocumentation;

export interface LinkedInterfaceDocumentation {
  properties: LinkedPropertyDocumentation[];
  description?: string;
  example?: string;
}

export interface LinkedTypeDocumentation {
  type: Link;
  description?: string;
  example?: string;
}

export interface LinkedPropertyDocumentation {
  name: string;
  type: Link;
  optional: boolean;
  description?: string;
  default?: string;
  example?: string;
}

export interface Link {
  to?: string;
  format: string;
}

export function preprocessForMarkdown(docs: Documentation[], log: (text: string) => void = () => {}): Record<string, LinkedDocumentation> {
  const linked: Record<string, LinkedDocumentation> = {};

  for (const doc of docs) {
    if ('type' in doc) {
      linked[doc.name] = {
        description: doc.description,
        example: doc.example,
        type: linkifyType(doc.type),
      };
    } else {
      const properties: LinkedPropertyDocumentation[] = [];

      for (const property of doc.properties) {
        properties.push({
          name: property.name,
          type: linkifyType(property.type),
          optional: property.optional ?? false,
          description: property.description,
          default: property.default,
          example: property.example,
        });
      }

      linked[doc.name] = {
        description: doc.description,
        example: doc.example,
        properties,
      };
    }
  }

  for (const doc of docs) {
    const linkedDoc = linked[doc.name];

    if ('type' in linkedDoc) {
      if (linkedDoc.type.to && !linked[linkedDoc.type.to]) {
        linkedDoc.type.format = linkedDoc.type.to;
        delete linkedDoc.type.to;

        log(`WARNING: Could not resolve type link for ${doc.name}`);
      }
    } else {
      for (const property of linkedDoc.properties) {
        if (property.type.to && !linked[property.type.to]) {
          property.type.format = property.type.to;
          delete property.type.to;

          log(`WARNING: Could not resolve type link for ${doc.name}.${property.name}`);
        }
      }
    }
  }

  return linked;
}

export function generateMarkdown(docs: Record<string, LinkedDocumentation>, format: 'tables' | 'json', log: (text: string) => void = () => {}): string {
  let out = '';

  for (const [name, doc] of Object.entries(docs)) {
    out += `\n## ${name}\n`;
    out += doc.description ? `${doc.description}  \n` : '';

    if ('type' in doc) {
      out += `Type: ${stringifyLink(doc.type)}\n`;
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

function generateTable(doc: LinkedInterfaceDocumentation): string {
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
    minLineLength.type = Math.max(minLineLength.type, stringifyLink(property.type).length);
    minLineLength.optional = Math.max(minLineLength.optional, String(property.optional).length);
    minLineLength.default = Math.max(minLineLength.default, (property.default ?? '').length);
    minLineLength.description = Math.max(minLineLength.description, (property.description ?? '').length);
    minLineLength.example = Math.max(minLineLength.example, (property.example ?? '').length);
  }

  out += `| ${'Property'.padEnd(minLineLength.property)} | ${'Type'.padEnd(minLineLength.type)} | ${'Optional'.padEnd(minLineLength.optional)} | ${'Default'.padEnd(minLineLength.default)} | ${'Description'.padEnd(minLineLength.description)} | ${'Example'.padEnd(minLineLength.example)} |\n`;
  out += `| ${'-'.repeat(minLineLength.property)} | ${'-'.repeat(minLineLength.type)} | ${'-'.repeat(minLineLength.optional)} | ${'-'.repeat(minLineLength.default)} | ${'-'.repeat(minLineLength.description)} | ${'-'.repeat(minLineLength.example)} |\n`;

  for (const property of doc.properties) {
    out += `| ${property.name.padEnd(minLineLength.property)} | ${stringifyLink(property.type).padEnd(minLineLength.type)} | ${(property.optional ? 'Yes' : 'No').padEnd(minLineLength.optional)} | ${(property.default ?? '-').padEnd(minLineLength.default)} | ${(property.description ?? '').padEnd(minLineLength.description)} | ${(property.example ?? '').padEnd(minLineLength.example)} |\n`;
  }

  return out;
}

function generateJSON(doc: LinkedInterfaceDocumentation): string {
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

    out += `  <strong>${property.name}</strong>${property.optional ? '?' : ''}: ${stringifyLink(property.type, true)},\n`;
  }

  out += `}\n`;
  out += '</pre>\n';

  return out;
}

function linkifyType(type: string): Link {
  if ([ 'string', 'number', 'boolean', 'any' ].includes(type)) {
    return {
      format: `${type}`,
    };
  } else if (type.endsWith('[]')) {
    return {
      to: type.slice(0, -2),
      format: '{}[]',
    };
  } else {
    return {
      to: type,
      format: '{}',
    };
  }
}

function stringifyLink(type: Link, useHTML = false): string {
  return type.to ? type.format.replace('{}', useHTML ? `<a href="#${type.to}">${type.to}</a>` : `[${type.to}](#${type.to})`) : type.format;
}