const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const {removeNumberingFromHeaders} = require('./helpers')


const SOURCE_DIR = path.join(__dirname, '..', '..', 'assets');

(() => {
	const files = fs.readdirSync(SOURCE_DIR)

	files.forEach(file => {
		if (!file.endsWith('.md')) return;

		const sourcePath = path.join(SOURCE_DIR, file);

		const processedContent = resetAssetsFile(sourcePath);
		fs.writeFileSync(sourcePath, processedContent, 'utf-8');
	});
})()

function resetAssetsFile(filePath) {
	const content = fs.readFileSync(filePath, 'utf-8');
	const {data: frontMatter, content: markdownContent} = matter(content);

	const cleanedContent = removeNumberingFromHeaders(markdownContent);

	return matter.stringify(cleanedContent, frontMatter);
}
