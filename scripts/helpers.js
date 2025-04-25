const cyrillicToTranslit = require('cyrillic-to-translit-js');
const transliterator = new cyrillicToTranslit();

function removeNumberingFromHeaders(content) {
	let cleanedContent = '';
	const lines = content.split('\n');

	lines.forEach(line => {
		const headerMatch = line.match(/^(#{1,6})\s+(?:\*\*)?\d+(\.\d+)*\.\s+(.*?)(?:\*\*)?$/);

		if (headerMatch)  cleanedContent += `${headerMatch[1]} ${headerMatch[3]}\n`;
		else  cleanedContent += `${line}\n`;
	});

	return cleanedContent.trim();
}

function processHeaders(content, headerTransformer) {
	let resultContent = '';

	content.split('\n').forEach(line => {
		const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);

		if (!headerMatch) {
			resultContent += `${line}\n`;
			return;
		}

		const sectionHashes = headerMatch[1];
		const headerText = headerMatch[2];
		
		const transformedHeader = headerTransformer(sectionHashes, headerText);
		resultContent += `${transformedHeader}\n`;
	});

	return resultContent.trim();
}

function createAnchorFromHeader(headerText) {
	const anchorMatch = headerText.match(/<Anchor\s*:ids="\[([^\]]*)\]"\s*\/>/);
	const cleanHeaderText = headerText.replace(/<Anchor.*?\/>/, '').trim();

	const slug = slugify(cleanHeaderText);
	
	let anchor;
	
	if (anchorMatch) {
		const existingIds = anchorMatch[1].split(',').map(id => id.trim());
		
		if (!existingIds.some(id => id === `'${slug}'`)) {
			existingIds.push(`'${slug}'`);
		}
		
		anchor = `<Anchor :ids="[${existingIds.join(', ')}]" />`;
	} else {
		anchor = createAnchorTag(slug);
	}
	
	return { anchor, cleanHeaderText };
}

function addNumberingToHeaders(content, initialSectionNumber = 0) {
	const sectionNumbers = [initialSectionNumber];

	return processHeaders(content, (sectionHashes, headerText) => {
		const level = sectionHashes.length;
		
		if (sectionNumbers.length < level) {
			while (sectionNumbers.length < level) {
				sectionNumbers.push(0);
			}
		} else {
			sectionNumbers.length = level;
		}
		
		sectionNumbers[level - 1]++;
		const sectionNumber = sectionNumbers.join('.');
		
		const { anchor, cleanHeaderText } = createAnchorFromHeader(headerText);
		
		return `${sectionHashes} ${anchor} ${sectionNumber}. ${cleanHeaderText}`;
	});
}

function addAnchorsToHeaders(content) {
	return processHeaders(content, (sectionHashes, headerText) => {
		const { anchor, cleanHeaderText } = createAnchorFromHeader(headerText);

		return `${sectionHashes} ${anchor} ${cleanHeaderText}`;
	});
}

function slugify(s) {
	const transliterated = transliterator.transform(String(s));
	return transliterated.trim().toLowerCase().replace(/\s+/g, '-');
}

function createAnchorTag(slug) {
	return `<Anchor :ids="['${slug}']" />`;
}

module.exports = {
	addNumberingToHeaders,
	removeNumberingFromHeaders,
	addAnchorsToHeaders
}
