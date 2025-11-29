/**
 * Block Editor Types
 * 
 * Type definitions for the WordPress-like block editor system.
 */

// Available block types
export type BlockType = 
    | 'paragraph'
    | 'heading'
    | 'image'
    | 'list'
    | 'quote'
    | 'button'
    | 'divider'
    | 'columns'
    | 'html';

// Block configuration
export interface BlockConfig {
    type: BlockType;
    name: string;
    icon: string;
    description: string;
    category: 'text' | 'media' | 'layout' | 'widgets';
}

// Base block interface
export interface BaseBlock {
    id: string;
    type: BlockType;
}

// Paragraph block
export interface ParagraphBlock extends BaseBlock {
    type: 'paragraph';
    content: string;
    alignment?: 'left' | 'center' | 'right';
}

// Heading block
export interface HeadingBlock extends BaseBlock {
    type: 'heading';
    content: string;
    level: 1 | 2 | 3 | 4 | 5 | 6;
    alignment?: 'left' | 'center' | 'right';
}

// Image block
export interface ImageBlock extends BaseBlock {
    type: 'image';
    url: string;
    alt: string;
    caption?: string;
    width?: number;
    alignment?: 'left' | 'center' | 'right' | 'wide' | 'full';
}

// List block
export interface ListBlock extends BaseBlock {
    type: 'list';
    items: string[];
    ordered: boolean;
}

// Quote block
export interface QuoteBlock extends BaseBlock {
    type: 'quote';
    content: string;
    citation?: string;
}

// Button block
export interface ButtonBlock extends BaseBlock {
    type: 'button';
    text: string;
    url: string;
    style: 'primary' | 'secondary' | 'outline';
    alignment?: 'left' | 'center' | 'right';
}

// Divider block
export interface DividerBlock extends BaseBlock {
    type: 'divider';
    style: 'solid' | 'dashed' | 'dotted';
}

// Columns block
export interface ColumnsBlock extends BaseBlock {
    type: 'columns';
    columns: number;
    content: Block[][];
}

// HTML block
export interface HTMLBlock extends BaseBlock {
    type: 'html';
    content: string;
}

// Union type of all blocks
export type Block = 
    | ParagraphBlock
    | HeadingBlock
    | ImageBlock
    | ListBlock
    | QuoteBlock
    | ButtonBlock
    | DividerBlock
    | ColumnsBlock
    | HTMLBlock;

// Block definitions
export const BLOCK_DEFINITIONS: Record<BlockType, BlockConfig> = {
    paragraph: {
        type: 'paragraph',
        name: 'Paragraaf',
        icon: 'fa-paragraph',
        description: 'Voeg tekst toe',
        category: 'text'
    },
    heading: {
        type: 'heading',
        name: 'Kop',
        icon: 'fa-heading',
        description: 'Voeg een kop toe (H1-H6)',
        category: 'text'
    },
    image: {
        type: 'image',
        name: 'Afbeelding',
        icon: 'fa-image',
        description: 'Voeg een afbeelding toe',
        category: 'media'
    },
    list: {
        type: 'list',
        name: 'Lijst',
        icon: 'fa-list',
        description: 'Voeg een genummerde of ongenummerde lijst toe',
        category: 'text'
    },
    quote: {
        type: 'quote',
        name: 'Citaat',
        icon: 'fa-quote-left',
        description: 'Voeg een citaat of blockquote toe',
        category: 'text'
    },
    button: {
        type: 'button',
        name: 'Knop',
        icon: 'fa-mouse-pointer',
        description: 'Voeg een call-to-action knop toe',
        category: 'widgets'
    },
    divider: {
        type: 'divider',
        name: 'Scheidingslijn',
        icon: 'fa-minus',
        description: 'Voeg een horizontale lijn toe',
        category: 'layout'
    },
    columns: {
        type: 'columns',
        name: 'Kolommen',
        icon: 'fa-columns',
        description: 'Voeg meerdere kolommen toe',
        category: 'layout'
    },
    html: {
        type: 'html',
        name: 'HTML',
        icon: 'fa-code',
        description: 'Voeg aangepaste HTML code toe',
        category: 'widgets'
    }
};

// Helper to create new blocks
export const createBlock = (type: BlockType): Block => {
    const id = `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    switch (type) {
        case 'paragraph':
            return { id, type: 'paragraph', content: '', alignment: 'left' };
        case 'heading':
            return { id, type: 'heading', content: '', level: 2, alignment: 'left' };
        case 'image':
            return { id, type: 'image', url: '', alt: '', alignment: 'center' };
        case 'list':
            return { id, type: 'list', items: [''], ordered: false };
        case 'quote':
            return { id, type: 'quote', content: '', citation: '' };
        case 'button':
            return { id, type: 'button', text: 'Klik hier', url: '#', style: 'primary', alignment: 'left' };
        case 'divider':
            return { id, type: 'divider', style: 'solid' };
        case 'columns':
            return { id, type: 'columns', columns: 2, content: [[], []] };
        case 'html':
            return { id, type: 'html', content: '' };
    }
};

// Convert blocks to HTML
export const blocksToHtml = (blocks: Block[]): string => {
    return blocks.map(block => {
        switch (block.type) {
            case 'paragraph':
                const pAlign = block.alignment ? `text-align: ${block.alignment}` : '';
                return `<p style="${pAlign}">${block.content}</p>`;
            
            case 'heading':
                const hAlign = block.alignment ? `text-align: ${block.alignment}` : '';
                return `<h${block.level} style="${hAlign}">${block.content}</h${block.level}>`;
            
            case 'image':
                const imgAlign = block.alignment === 'center' ? 'margin: 0 auto; display: block' : '';
                const width = block.width ? `width: ${block.width}px` : 'max-width: 100%';
                const caption = block.caption ? `<figcaption>${block.caption}</figcaption>` : '';
                return `<figure style="${imgAlign}"><img src="${block.url}" alt="${block.alt}" style="${width}" />${caption}</figure>`;
            
            case 'list':
                const tag = block.ordered ? 'ol' : 'ul';
                const items = block.items.map(item => `<li>${item}</li>`).join('');
                return `<${tag}>${items}</${tag}>`;
            
            case 'quote':
                const cite = block.citation ? `<cite>— ${block.citation}</cite>` : '';
                return `<blockquote>${block.content}${cite}</blockquote>`;
            
            case 'button':
                const btnAlign = block.alignment === 'center' ? 'text-align: center' : block.alignment === 'right' ? 'text-align: right' : '';
                return `<div style="${btnAlign}"><a href="${block.url}" class="button button-${block.style}">${block.text}</a></div>`;
            
            case 'divider':
                return `<hr style="border-style: ${block.style}" />`;
            
            case 'columns':
                const colWidth = `${100 / block.columns}%`;
                const cols = block.content.map(col => 
                    `<div style="flex: 1; padding: 0 10px">${blocksToHtml(col)}</div>`
                ).join('');
                return `<div style="display: flex; gap: 20px">${cols}</div>`;
            
            case 'html':
                return block.content;
            
            default:
                return '';
        }
    }).join('\n');
};

// Parse HTML to blocks (basic implementation)
export const htmlToBlocks = (html: string): Block[] => {
    const blocks: Block[] = [];
    
    // Simple regex-based parsing for common elements
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const processNode = (node: Node): Block | null => {
        if (node.nodeType !== Node.ELEMENT_NODE) return null;
        
        const element = node as Element;
        const tagName = element.tagName.toLowerCase();
        const id = `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        switch (tagName) {
            case 'p':
                return { id, type: 'paragraph', content: element.innerHTML };
            case 'h1':
            case 'h2':
            case 'h3':
            case 'h4':
            case 'h5':
            case 'h6':
                return { 
                    id, 
                    type: 'heading', 
                    content: element.innerHTML, 
                    level: parseInt(tagName[1]) as 1 | 2 | 3 | 4 | 5 | 6 
                };
            case 'figure':
            case 'img':
                const img = tagName === 'img' ? element : element.querySelector('img');
                if (img) {
                    return { 
                        id, 
                        type: 'image', 
                        url: img.getAttribute('src') || '', 
                        alt: img.getAttribute('alt') || '',
                        caption: element.querySelector('figcaption')?.textContent || ''
                    };
                }
                return null;
            case 'ul':
            case 'ol':
                const items = Array.from(element.querySelectorAll('li')).map(li => li.innerHTML);
                return { id, type: 'list', items, ordered: tagName === 'ol' };
            case 'blockquote':
                const cite = element.querySelector('cite');
                return { 
                    id, 
                    type: 'quote', 
                    content: element.innerHTML.replace(/<cite>.*<\/cite>/i, '').trim(),
                    citation: cite?.textContent?.replace('— ', '') || ''
                };
            case 'hr':
                return { id, type: 'divider', style: 'solid' };
            default:
                // Wrap unknown elements in HTML block
                return { id, type: 'html', content: element.outerHTML };
        }
    };
    
    doc.body.childNodes.forEach(node => {
        const block = processNode(node);
        if (block) {
            blocks.push(block);
        }
    });
    
    // If no blocks were parsed, create a paragraph with the raw HTML
    if (blocks.length === 0 && html.trim()) {
        blocks.push({
            id: `block-${Date.now()}`,
            type: 'paragraph',
            content: html
        });
    }
    
    return blocks;
};
