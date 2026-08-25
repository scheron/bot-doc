#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import matter from 'gray-matter';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SOURCE_PREFIX = 'assets/ru/';
const TARGET_PREFIX = 'assets/en/';
const TERMINOLOGY_FILE = path.join(ROOT, '.github', 'prompts', 'terminology.md');
const DO_NOT_TRANSLATE_FILE = path.join(ROOT, '.github', 'prompts', 'do-not-translate.md');

/**
 * Reads the parts of the glossary that can be checked without guessing.
 *
 * Russian inflects, so a term on the left of the Terms table cannot be matched
 * reliably. These two sections match exactly and so are safe to enforce.
 *
 * Human decisions (terminology.md) and the machine-written list of
 * untranslatable terms (do-not-translate.md) live in separate files, so a
 * mining run can only ever append to the second one.
 *
 * @returns {{banned: Array<{wrong: string, right: string}>, verbatim: string[]}} Enforceable rules.
 */
export function readGlossary() {
  const terminology = existsSync(TERMINOLOGY_FILE) ? readFileSync(TERMINOLOGY_FILE, 'utf8') : '';
  const doNotTranslate = existsSync(DO_NOT_TRANSLATE_FILE) ? readFileSync(DO_NOT_TRANSLATE_FILE, 'utf8') : '';

  const section = title => {
    const body = terminology.split(`## ${title}`)[1];
    return body ? body.split('\n## ')[0] : '';
  };

  const banned = [...section('Do not use').matchAll(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/gm)]
    .map(match => ({ wrong: match[1], right: match[2] }))
    .filter(rule => rule.wrong !== 'Wrong' && !/^-+$/.test(rule.wrong));

  const verbatim = [...doNotTranslate.matchAll(/^`([^`]+)`$/gm)].map(match => match[1]);

  return { banned, verbatim };
}

const glossary = readGlossary();

const errors = [];
const warnings = [];

function checkBannedWording(file) {
  const content = readFileSync(file, 'utf8');
  for (const { wrong, right } of glossary.banned) {
    const pattern = new RegExp(`(?<![\\p{L}])${wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'giu');
    if (pattern.test(content)) {
      errors.push(`${path.relative(ROOT, file)}: uses "${wrong}"; the glossary settles on "${right}"`);
    }
  }
}

function checkVerbatimTerms(sourceFile, targetFile) {
  const source = readFileSync(sourceFile, 'utf8');
  const target = readFileSync(targetFile, 'utf8');
  const missing = glossary.verbatim.filter(term => source.includes(term) && !target.includes(term));
  if (missing.length) {
    // A warning, not an error: some of these read as prose in Russian and are
    // reworded legitimately. Promote a term to Do not use once a case is proven.
    warnings.push(`${path.relative(ROOT, targetFile)}: interface wording may have been translated: ${missing.join(', ')}`);
  }
}

function checkStructure(sourceFile, targetFile) {
  const headings = file => (readFileSync(file, 'utf8').match(/^#{1,6} /gm) ?? []).length;
  const source = headings(sourceFile);
  const target = headings(targetFile);
  if (source !== target) {
    warnings.push(
      `${path.relative(ROOT, targetFile)}: ${target} headings against ${source} in Russian, so the two have drifted apart`,
    );
  }
}
function findDocuments(directory, prefix = SOURCE_PREFIX) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relative = `${prefix}${entry.name}`;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return findDocuments(absolute, `${relative}/`);
    return /\.mdx?$/i.test(entry.name) ? [relative] : [];
  });
}


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

function main() {
  const requestedDocuments = process.argv.slice(2);
  const documents = (requestedDocuments.length ? requestedDocuments : findDocuments(path.join(ROOT, SOURCE_PREFIX)))
    .filter(file => file.startsWith(SOURCE_PREFIX) && /\.mdx?$/i.test(file));

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
    checkBannedWording(targetFile);
    checkVerbatimTerms(sourceFile, targetFile);
    checkStructure(sourceFile, targetFile);
  }

  if (warnings.length) {
    console.warn(warnings.map(warning => `::warning::${warning}`).join('\n'));
  }

  if (errors.length) {
    console.error(errors.map(error => `- ${error}`).join('\n'));
    process.exit(1);
  }

  console.log(`Validated ${documents.length} Russian/English document pair(s).`);

}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
