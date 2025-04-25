const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const {addNumberingToHeaders, addAnchorsToHeaders} = require('./helpers')

const WARN_PLACEHOLDER = `\
[//]: # (====== AUTO-GENERATED FILE ======)
[//]: # (THIS FILE WAS AUTOMATICALLY GENERATED. ANY DIRECT MODIFICATIONS MAY BE OVERWRITTEN.)
[//]: # (DO NOT MODIFY THIS FILE DIRECTLY.)
[//]: # (TO UPDATE THE DOCUMENTATION, NAVIGATE TO THE 'ASSETS' FOLDER.)
\n`;

const SOURCE_DIR = path.join(__dirname, '..', 'assets');
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'docs');

function generateDocs(sourceDir, outputDir) {
	if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

	fs.readdirSync(sourceDir).forEach(file => {
		const sourcePath = path.join(sourceDir, file);
		const outputPath = path.join(outputDir, file);

		if (file.endsWith('.md')) {
			const processedContent = generateDocFile(sourcePath);
			fs.writeFileSync(outputPath, processedContent, 'utf-8');
			return
		}

		if (fs.lstatSync(sourcePath).isDirectory()) {
			if (!fs.existsSync(outputPath)) fs.mkdirSync(outputPath);

			generateDocs(sourcePath, outputPath);
			return;
		}

		fs.copyFileSync(sourcePath, outputPath);
	});
}

generateDocs(SOURCE_DIR, OUTPUT_DIR)


function generateDocFile(filePath) {
	const content = fs.readFileSync(filePath, 'utf-8');
	const {data: frontMatter, content: markdownContent} = matter(content);

	const processedContent = (frontMatter?.['ignore-section-number']) ?
		addAnchorsToHeaders(markdownContent) :
		addNumberingToHeaders(markdownContent, frontMatter?.section ? frontMatter.section - 1 : 0);

	return matter.stringify('', frontMatter).concat(WARN_PLACEHOLDER, '\n\n', processedContent);
}
