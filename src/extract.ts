import ts from 'typescript';
import { log } from './logger';

export type Documentation = InterfaceDocumentation |  TypeDocumentation;

export interface Type {
  types: string[];
  /** `"{} | {}[]"` would turn into `"Type1 | Type2[]"` */
  format: string;
}

export interface PropertyDocumentation {
  name: string;
  description?: string;
  example?: string;
  optional?: boolean;
  default?: string;
  type: Type;
}

export interface InterfaceDocumentation {
  name: string;
  description?: string;
  example?: string;
  properties: PropertyDocumentation[];
}

export interface TypeDocumentation {
  name: string;
  description?: string;
  example?: string;
  type: Type;
}

const resolvedImports: Map<string, Documentation[] | null> = new Map();

export async function extractDocumentation(contents: string): Promise<Documentation[]> {
  const docs: Documentation[] = [];

  log('Parsing file');
  const sourceFile = ts.createSourceFile('file.ts', contents, { languageVersion: ts.ScriptTarget.Latest, jsDocParsingMode: ts.JSDocParsingMode.ParseAll }, true);

  log('Extracting interfaces and types');
  for (const node of sourceFile.statements) {
    if (ts.isInterfaceDeclaration(node)) {
      if (!node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword)) {
        log(`Skipping non-exported interface ${node.name.text}`);
        continue;
      }

      log(`Extracting documentation for interface ${node.name.text}`);
      const properties: PropertyDocumentation[] = [];

      for (const member of node.members) {
        if (!ts.isPropertySignature(member)) {
          log(`Skipping non-property member ${member.name?.getText()}`);
          continue;
        }

        const prop = extractPropertyDocumentation(member);
        properties.push(prop);

        if (prop.type.types.includes('any')) {
          log(`WARNING: Could not resolve type for ${node.name.text}.${prop.name}, using 'any'`);
        }
      }

      const jsDoc = node.getChildren().find(child => ts.isJSDoc(child)) as ts.JSDoc | undefined;

      docs.push({
        name: node.name.text,
        description: getJSDocComment(jsDoc),
        example: getJSDocComment(jsDoc?.tags?.find(tag => tag.tagName.text === 'example')),
        properties,
      });
    } else if (ts.isTypeAliasDeclaration(node)) {
      if (!node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword)) {
        log(`Skipping non-exported type ${node.name.text}`);
        continue;
      }
      
      log(`Extracting documentation for type ${node.name.text}`);

      const jsDoc = node.getChildren().find(child => ts.isJSDoc(child)) as ts.JSDoc | undefined;

      docs.push({
        name: node.name.text,
        description: getJSDocComment(jsDoc),
        example: getJSDocComment(jsDoc?.tags?.find(tag => tag.tagName.text === 'example')),
        type: extractType(node.type),
      });
    } else if (ts.isImportDeclaration(node)) {
      log('WARNING: Importing is not supported yet');

      // if (!ts.isStringLiteral(node.moduleSpecifier)) {
      //   log(`WARNING: Cannot import ${node.moduleSpecifier.getText()}, not a string literal - grammar error?`);
      //   continue;
      // }
      
      // const importSource = node.moduleSpecifier.text;

      // if (!resolvedImports.has(importSource)) {
      //   resolvedImports.set(importSource, null);
        
      //   const importFile = importSource.replace(/\.ts$/, '') + '.ts';
      //   log(`Importing ${importFile}`);
        
      //   const importContents = await Bun.file(importFile).text();
        
      //   resolvedImports.set(importSource, await extractDocumentation(importContents));
      // } else if (resolvedImports.get(importSource) === null) {
      //   log(`WARNING: Cannot import ${node.moduleSpecifier.getText()}, circular reference?`);
      //   continue;
      // }

      // const importedDocs = resolvedImports.get(importSource);

      // if (!importedDocs) {
      //   log(`WARNING: Cannot import ${node.moduleSpecifier.getText()}, could not resolve`);
      //   continue;
      // }

      // docs.push(...importedDocs);
    } else {
      log(`Skipping non-interface node ${(node as any)?.name?.text ?? node.getText()}, kind: ${node.kind}`);
    }
  }

  return docs;
}

function extractPropertyDocumentation(node: ts.PropertySignature): PropertyDocumentation {
  const name = node.name.getText();
  const type = extractType(node.type);
  const optional = node.questionToken !== undefined;

  const jsDoc = node.getChildren().find(child => ts.isJSDoc(child)) as ts.JSDoc | undefined;

  const description = getJSDocComment(jsDoc);
  const $default = getJSDocComment(jsDoc?.tags?.find(tag => tag.tagName.text === 'default'));
  const example = getJSDocComment(jsDoc?.tags?.find(tag => tag.tagName.text === 'example'));

  return {
    name,
    type,
    optional,
    description,
    default: $default,
    example,
  };
}

function extractType(node?: ts.TypeNode): Type {
  if (!node) {
    return {
      types: ['any'],
      format: '{}',
    };
  }

  if (ts.isTypeReferenceNode(node)) {
    return {
      types: [node.typeName.getText()],
      format: '{}',
    };
  }

  if (ts.isArrayTypeNode(node)) {
    const type = extractType(node.elementType);
    return {
      types: type.types,
      format: `${type.format}[]`,
    };
  }

  if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
    const types = node.types.map(extractType);
    return {
      types: types.flatMap(t => t.types),
      format: types.map(t => t.format).join(' | '),
    };
  }

  return {
    types: [node.getText()],
    format: '{}',
  };

}

function getJSDocComment(node?: Pick<ts.JSDoc, 'comment'>): string | undefined {
  return Array.isArray(node?.comment) ?
    node.comment.map(c => c.text).join('\n') :
    (node?.comment as string | undefined);
}
