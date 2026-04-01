#!/usr/bin/env node
import { Command } from "commander";
import { ingestCommand } from "./commands/ingest.js";
import { scaleCommand } from "./commands/scale.js";

const program = new Command();

program
  .name("plainfare")
  .description("Markdown-first recipe management tool")
  .version("0.1.0");

program.addCommand(ingestCommand);
program.addCommand(scaleCommand);

program.parse();
