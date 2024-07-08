import type { BunFile } from 'bun';
import { ArgumentParser } from './args';
import { extractDocumentation } from './extract';
import { generateMarkdown, preprocessForMarkdown } from './markdown';

const argParser = new ArgumentParser()
  .flag('help', 'h')
  .flag('force', 'f')
  .flag('verbose')
  .option('input', 'i')
  .option('output', 'o')
  .option('format')
  .doubleDash();

const args = argParser.parse(process.argv.slice(2));

if (args.help) {
  console.log(argParser.generateHelp({
    usage: 'interface-docs [options] -i <input> [-o <output>]',
    description: 'Generate markdown documentation from TypeScript interfaces and types\nNOTE: Only exported interfaces/types are documented',
    customHelp: {
      input: 'The input file to read interfaces and types from. Will ignore any code that is not exported or is not an interface or type',
      output: 'The output file to write markdown to. Defaults to the input file with a .md extension. Use - to write to stdout',
      format: 'The format to output the documentation in. Can be "tables" or "json" (default: tables)',
      force: 'Overwrite the output file if it already exists',
      verbose: 'Print debug information',
    }
  }));
  process.exit(0);
}

const format = (args.format as string) ?? 'tables';

if (!['tables', 'json'].includes(format)){
  console.error(`Invalid format: ${format}`);
  process.exit(1);
}

const input = args.input as string;

if (!input) {
  console.error('No input file specified');
  process.exit(1);
}

if (!input.endsWith('.ts')) {
  console.error('Input file must be a .ts file');
  process.exit(1);
}

let output: string | undefined | BunFile = args.output as string | undefined;

if (output && !output.endsWith('.md') && output !== '-') {
  console.error('Output file must be a .md file or stdout (-)');
  process.exit(1);
}

if (!output) {
  output = input.replace(/\.ts$/, '.md');
}

output = output === '-' ? Bun.stdout : Bun.file(output);

const force = args.force ?? false as boolean;

if (await output.exists() && !force) {
  console.error('Output file already exists. Use -f to overwrite');
  process.exit(1);
}

const verbose = args.verbose ?? false as boolean;

if (verbose) console.log(`Reading file ${input}`);
const fileContents = await Bun.file(input).text();

if (verbose) console.log('Extracting documentation');
const extracted = await extractDocumentation(fileContents, verbose ? console.debug : () => {});

if (verbose) console.log('Preprocessing extracted information');
const linked = preprocessForMarkdown(extracted, verbose ? console.debug : () => {});

if (verbose) console.log('Generating markdown');
const markdown = generateMarkdown(linked, format as 'tables' | 'json', verbose ? console.debug : () => {});

if (verbose) console.log('Writing documentation');
await Bun.write(output, markdown);

if (verbose) {
  if (output !== Bun.stdout) {
    console.log(`Wrote documentation to ${output.name}`);
  } else {
    console.log();
  }
}
