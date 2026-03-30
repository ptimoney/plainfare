#!/usr/bin/env node
import { Command } from "commander";
import { parseCommand } from "./commands/parse.js";
import { normaliseCommand } from "./commands/normalise.js";

const program = new Command();

program
  .name("recipe")
  .description("Markdown-first recipe management tool")
  .version("0.1.0");

program.addCommand(parseCommand);
program.addCommand(normaliseCommand);

program.parse();
