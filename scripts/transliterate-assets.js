const fs = require('fs');
const path = require('path');
const { transliterateLinks } = require('./helpers');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

function processDirectory(directoryPath) {
  const files = fs.readdirSync(directoryPath);
  
  files.forEach(file => {
    const filePath = path.join(directoryPath, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      processDirectory(filePath);
    } else if (file.endsWith('.md')) {
      processMarkdownFile(filePath);
    }
  });
}

function processMarkdownFile(filePath) {
  console.log(`\nОбработка файла: ${filePath}`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    const linkRegex = /\[([^\]]+)\]\(([^)]+\.md)#([^)]+)\)/g;
    const links = content.match(linkRegex);
    
    if (links) {
      links.forEach(link =>  console.log(`Ссылка: ${link}`));
    }
    
    const processedContent = transliterateLinks(content);
    
    if (content !== processedContent) {
      fs.writeFileSync(filePath, processedContent, 'utf8');
      console.log(`✓ Файл успешно обработан: ${filePath}`);
    } 
  } catch (error) {
    console.error(`✗ Ошибка при обработке файла ${filePath}:`, error);
  }
}

processDirectory(ASSETS_DIR);