#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE_PREFIX = 'assets/ru/';
const TARGET_PREFIX = 'assets/en/';
function findDocuments(directory, prefix = SOURCE_PREFIX) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relative = `${prefix}${entry.name}`;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return findDocuments(absolute, `${relative}/`);
    return /\.mdx?$/i.test(entry.name) ? [relative] : [];
  });
}

const requestedDocuments = process.argv.slice(2);
const documents = (requestedDocuments.length ? requestedDocuments : findDocuments(path.join(ROOT, SOURCE_PREFIX)))
  .filter(file => file.startsWith(SOURCE_PREFIX) && /\.mdx?$/i.test(file));
const errors = [];

function checkFrontmatter(sourceFile, targetFile) {
  const source = matter(readFileSync(sourceFile, 'utf8')).data;
  const target = matter(readFileSync(targetFile, 'utf8')).data;
  const sourceKeys = Object.keys(source).sort();
  const targetKeys = Object.keys(target).sort();
  if (JSON.stringify(sourceKeys) !== JSON.stringify(targetKeys)) {
    errors.push(`${path.relative(ROOT, targetFile)}: frontmatter keys differ (${sourceKeys.join(', ')} vs ${targetKeys.join(', ')})`);
  }
}

function checkLinks(file) {
  const content = readFileSync(file, 'utf8');
  const linkPattern = /!?(?:\[[^\]]*\])\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  for (const match of content.matchAll(linkPattern)) {
    const href = match[1].replace(/^<|>$/g, '');
    if (/^(?:[a-z]+:|#|\/|@)/i.test(href)) continue;
    const pathname = decodeURIComponent(href.split('#')[0].split('?')[0]);
    if (!pathname || !/\.mdx?$/i.test(pathname)) continue;
    const resolved = path.resolve(path.dirname(file), pathname);
    if (!existsSync(resolved)) errors.push(`${path.relative(ROOT, file)}: broken local link ${href}`);
  }
}

for (const document of documents) {
  const sourceFile = path.join(ROOT, document);
  const targetFile = path.join(ROOT, document.replace(/^assets\/ru\//, TARGET_PREFIX));
  if (!existsSync(sourceFile)) continue;
  if (!existsSync(targetFile)) {
    errors.push(`${path.relative(ROOT, targetFile)}: English counterpart is missing`);
    continue;
  }
  try { checkFrontmatter(sourceFile, targetFile); } catch (error) {
    errors.push(`${path.relative(ROOT, targetFile)}: invalid frontmatter (${error.message})`);
  }
  checkLinks(sourceFile);
  checkLinks(targetFile);
}

if (errors.length) {
  console.error(errors.map(error => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(`Validated ${documents.length} Russian/English document pair(s).`);
