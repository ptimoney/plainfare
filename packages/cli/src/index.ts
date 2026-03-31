#!/usr/bin/env node
import { Command } from "commander";
import { ingestCommand } from "./commands/ingest.js";

const program = new Command();

program
  .name("mise")
  .description("Markdown-first recipe management tool")
  .version("0.1.0");

program.addCommand(ingestCommand);

program.parse();
