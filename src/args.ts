type ArgumentType = {
  args: string[];
} & Record<string, string | boolean>;

interface HelpGenerationOptions {
  usage?: string;
  description?: string;
  group?: 'by_type' | 'alphabetical';
  
  /**
   * Custom help text for each option
   */
  customHelp?: Record<string, string>;
}

export class ArgumentParser {
  /**
   * Boolean options
   */
  private flags: string[] = [];
  
  /**
   * Options that require a value
   * Key is option name, value is the validator function
   */
  private options: string[] = [];

  private aliases: Map<string, string> = new Map();

  /**
   * Allow double dash (--) to separate options and program arguments
   */
  private allowDoubleDash = false;

  /**
   * Add a flag
   * @param flag Flag name
   */
  public flag(flag: string, ...alias: string[]): this {
    this.flags.push(flag);
    alias.forEach(a => this.aliases.set(a, flag));
    
    return this;
  }

  /**
   * Add an option
   * @param option Option name
   * @param validator Optional validator function
   */
  public option(option: string, ...alias: string[]): this {
    this.options.push(option);
    alias.forEach(a => this.aliases.set(a, option));
    return this;
  }

  /**
   * Allow double dash (--) to separate options and program arguments
   */
  public doubleDash(): this {
    this.allowDoubleDash = true;
    return this;
  }

  public parse(args: string[]): ArgumentType {
    const doubleDashIndex = this.allowDoubleDash ? args.indexOf('--') : -1;

    const parsed = { args: [] } as any;

    for (let i = 0; i < args.length; i++) {
      if (i === doubleDashIndex) {
        parsed.args.push(...args.slice(i + 1));
        break;
      }

      const arg = args[i];

      if (arg.startsWith('-')) {
        let option = arg.startsWith('--') ? arg.slice(2) : arg.slice(1);
        let value: string | null = null;

        if (option.includes('=')) {
          const equalsIndex = option.indexOf('=');
          value = option.slice(equalsIndex + 1);
          option = option.slice(0, equalsIndex);
        }

        option = this.aliases.get(option) ?? option;

        if (this.flags.includes(option)) {
          if (value !== null) {
            throw new Error(`Flag ${option} does not accept a value`);
          }

          parsed[option] = true;
        } else if (this.options.includes(option)) {
          if (value === null) {
            value = args[++i];
          }

          parsed[option] = value;
        }
      } else {
        parsed.args.push(arg);
      }
    }

    return parsed as ArgumentType;
  }

  public generateHelp(options?: HelpGenerationOptions): string {
    const group = options?.group ?? 'by_type';
    
    const customHelp = options?.customHelp ?? {};

    const help = [];

    if (options?.usage) {
      help.push(options.usage);
      help.push('');
    }

    if (options?.description) {
      help.push(options.description);
      help.push('');
    }

    const flagText: { option: string; text: string }[] = [];

    for (const flag of this.flags) {
      const aliases = [...this.aliases.entries()].filter(([_, value]) => value === flag).map(([key]) => key);
      let aliasText = '';
      if (aliases.length > 0) {
        aliasText = ` ${aliases.map(a => `-${a}`).join(', ')}`;
        aliasText += ', ';
      }
      flagText.push({
        option: flag,
        text: (`${aliasText}--${flag}\t` + (customHelp[flag] ?? '')).trim()
      });
    }

    const optionText: { option: string; text: string }[] = [];
    
    for (const option of this.options) {
      const aliases = [...this.aliases.entries()].filter(([_, value]) => value === option).map(([key]) => key);
      let aliasText = '';
      if (aliases.length > 0) {
        aliasText = ` ${aliases.map(a => `-${a}`).join(', ')}`;
        aliasText += ', ';
      }
      optionText.push({
        option,
        text: (`${aliasText}--${option}=<value>\t` + (customHelp[option] ?? '')).trim()
      });
    }

    if (group === 'by_type') {
      if (flagText.length > 0) {
        help.push('Flags:');
        for (const { text } of flagText) {
          help.push(`  ${text}`);
        }
      }

      help.push('');

      if (optionText.length > 0) {
        help.push('Options:');
        for (const { text } of optionText) {
          help.push(`  ${text}`);
        }
      }
    } else if (group === 'alphabetical') {
      const allOptions = [...flagText, ...optionText].sort((a, b) => a.option.localeCompare(b.option));
      if (allOptions.length > 0) {
        help.push('Options:');
        for (const { text } of allOptions) {
          help.push(`  ${text}`);
        }
      }
    }

    return help.join('\n');
  }
}