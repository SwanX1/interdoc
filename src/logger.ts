let isVerbose = false;

export function setVerbose(): void {
  isVerbose = true;
}

export function log(line: string): void {
  if (isVerbose) console.log(line);
}

export function invalidUsage(error: string): never {
  console.error(error);
  console.log('Use --help for usage.');
  process.exit(1);
}
