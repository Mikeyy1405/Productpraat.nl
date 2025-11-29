/**
 * Block Components
 * 
 * Individual block editors for each block type.
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
    Block, 
    ParagraphBlock, 
    HeadingBlock, 
    ImageBlock, 
    ListBlock, 
    QuoteBlock,
    ButtonBlock,
    DividerBlock,
    HTMLBlock
} from './types';

interface BlockEditorProps<T extends Block> {
    block: T;
    onChange: (block: T) => void;
    onDelete: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    isFirst: boolean;
    isLast: boolean;
    isSelected: boolean;
    onSelect: () => void;
}

// Block wrapper with toolbar
const BlockWrapper: React.FC<{
    children: React.ReactNode;
    onDelete: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    isFirst: boolean;
    isLast: boolean;
    isSelected: boolean;
    onSelect: () => void;
    blockType: string;
    blockIcon: string;
}> = ({ 
    children, 
    onDelete, 
    onMoveUp, 
    onMoveDown, 
    isFirst, 
    isLast, 
    isSelected, 
    onSelect,
    blockType,
    blockIcon
}) => {
    return (
        <div 
            className={`group relative mb-4 transition-all ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
            onClick={onSelect}
        >
            {/* Block type indicator */}
            <div className={`absolute -left-2 top-0 bottom-0 w-1 rounded-full transition ${isSelected ? 'bg-blue-500' : 'bg-transparent group-hover:bg-slate-600'}`}></div>
            
            {/* Block toolbar */}
            <div className={`absolute -left-12 top-1/2 -translate-y-1/2 flex flex-col gap-1 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <button
                    onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
                    disabled={isFirst}
                    className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded disabled:opacity-30 disabled:cursor-not-allowed transition"
                    title="Omhoog verplaatsen"
                >
                    <i className="fas fa-chevron-up text-xs"></i>
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
                    disabled={isLast}
                    className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded disabled:opacity-30 disabled:cursor-not-allowed transition"
                    title="Omlaag verplaatsen"
                >
                    <i className="fas fa-chevron-down text-xs"></i>
                </button>
            </div>

            {/* Block content */}
            <div className={`bg-slate-900 border rounded-lg p-4 transition ${isSelected ? 'border-blue-500' : 'border-slate-800 hover:border-slate-700'}`}>
                {/* Block header */}
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2 text-slate-400">
                        <i className={`fas ${blockIcon} text-sm`}></i>
                        <span className="text-xs font-medium uppercase">{blockType}</span>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded transition"
                        title="Blok verwijderen"
                    >
                        <i className="fas fa-trash text-xs"></i>
                    </button>
                </div>
                
                {children}
            </div>
        </div>
    );
};

// Paragraph Block Editor
export const ParagraphBlockEditor: React.FC<BlockEditorProps<ParagraphBlock>> = ({
    block, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast, isSelected, onSelect
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [block.content]);

    return (
        <BlockWrapper 
            onDelete={onDelete} 
            onMoveUp={onMoveUp} 
            onMoveDown={onMoveDown}
            isFirst={isFirst}
            isLast={isLast}
            isSelected={isSelected}
            onSelect={onSelect}
            blockType="Paragraaf"
            blockIcon="fa-paragraph"
        >
            {/* Alignment toolbar */}
            <div className="flex gap-1 mb-3">
                {(['left', 'center', 'right'] as const).map(align => (
                    <button
                        key={align}
                        onClick={() => onChange({ ...block, alignment: align })}
                        className={`p-2 rounded transition ${block.alignment === align ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                    >
                        <i className={`fas fa-align-${align}`}></i>
                    </button>
                ))}
            </div>
            
            <textarea
                ref={textareaRef}
                value={block.content}
                onChange={(e) => onChange({ ...block, content: e.target.value })}
                placeholder="Begin met typen..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500 resize-none min-h-[80px] transition"
                style={{ textAlign: block.alignment }}
            />
        </BlockWrapper>
    );
};

// Heading Block Editor
export const HeadingBlockEditor: React.FC<BlockEditorProps<HeadingBlock>> = ({
    block, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast, isSelected, onSelect
}) => {
    const fontSizes: Record<number, string> = {
        1: 'text-3xl',
        2: 'text-2xl',
        3: 'text-xl',
        4: 'text-lg',
        5: 'text-base',
        6: 'text-sm'
    };

    return (
        <BlockWrapper 
            onDelete={onDelete} 
            onMoveUp={onMoveUp} 
            onMoveDown={onMoveDown}
            isFirst={isFirst}
            isLast={isLast}
            isSelected={isSelected}
            onSelect={onSelect}
            blockType="Kop"
            blockIcon="fa-heading"
        >
            {/* Level and alignment toolbar */}
            <div className="flex gap-4 mb-3">
                <div className="flex gap-1">
                    {([1, 2, 3, 4, 5, 6] as const).map(level => (
                        <button
                            key={level}
                            onClick={() => onChange({ ...block, level })}
                            className={`px-2 py-1 rounded text-sm font-bold transition ${block.level === level ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                        >
                            H{level}
                        </button>
                    ))}
                </div>
                <div className="flex gap-1">
                    {(['left', 'center', 'right'] as const).map(align => (
                        <button
                            key={align}
                            onClick={() => onChange({ ...block, alignment: align })}
                            className={`p-2 rounded transition ${block.alignment === align ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                        >
                            <i className={`fas fa-align-${align}`}></i>
                        </button>
                    ))}
                </div>
            </div>
            
            <input
                type="text"
                value={block.content}
                onChange={(e) => onChange({ ...block, content: e.target.value })}
                placeholder="Kop tekst..."
                className={`w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500 transition font-bold ${fontSizes[block.level]}`}
                style={{ textAlign: block.alignment }}
            />
        </BlockWrapper>
    );
};

// Image Block Editor
export const ImageBlockEditor: React.FC<BlockEditorProps<ImageBlock>> = ({
    block, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast, isSelected, onSelect
}) => {
    return (
        <BlockWrapper 
            onDelete={onDelete} 
            onMoveUp={onMoveUp} 
            onMoveDown={onMoveDown}
            isFirst={isFirst}
            isLast={isLast}
            isSelected={isSelected}
            onSelect={onSelect}
            blockType="Afbeelding"
            blockIcon="fa-image"
        >
            {/* Alignment toolbar */}
            <div className="flex gap-1 mb-3">
                {(['left', 'center', 'right', 'wide', 'full'] as const).map(align => (
                    <button
                        key={align}
                        onClick={() => onChange({ ...block, alignment: align })}
                        className={`px-3 py-1.5 rounded text-xs transition ${block.alignment === align ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                    >
                        {align === 'left' && <i className="fas fa-align-left"></i>}
                        {align === 'center' && <i className="fas fa-align-center"></i>}
                        {align === 'right' && <i className="fas fa-align-right"></i>}
                        {align === 'wide' && <i className="fas fa-arrows-alt-h"></i>}
                        {align === 'full' && <i className="fas fa-expand"></i>}
                    </button>
                ))}
            </div>
            
            <div className="space-y-3">
                <div>
                    <label className="text-xs text-slate-500 mb-1 block">Afbeelding URL</label>
                    <input
                        type="url"
                        value={block.url}
                        onChange={(e) => onChange({ ...block, url: e.target.value })}
                        placeholder="https://..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500 transition text-sm"
                    />
                </div>
                
                {block.url && (
                    <div className="relative rounded-lg overflow-hidden bg-slate-950">
                        <img 
                            src={block.url} 
                            alt={block.alt} 
                            className="max-h-48 w-auto mx-auto"
                            onError={(e) => (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x200?text=Afbeelding+niet+gevonden'}
                        />
                    </div>
                )}
                
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-slate-500 mb-1 block">Alt tekst</label>
                        <input
                            type="text"
                            value={block.alt}
                            onChange={(e) => onChange({ ...block, alt: e.target.value })}
                            placeholder="Beschrijving voor toegankelijkheid"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500 transition text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 mb-1 block">Onderschrift</label>
                        <input
                            type="text"
                            value={block.caption || ''}
                            onChange={(e) => onChange({ ...block, caption: e.target.value })}
                            placeholder="Optioneel onderschrift"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500 transition text-sm"
                        />
                    </div>
                </div>
            </div>
        </BlockWrapper>
    );
};

// List Block Editor
export const ListBlockEditor: React.FC<BlockEditorProps<ListBlock>> = ({
    block, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast, isSelected, onSelect
}) => {
    const addItem = () => {
        onChange({ ...block, items: [...block.items, ''] });
    };

    const removeItem = (index: number) => {
        if (block.items.length > 1) {
            onChange({ ...block, items: block.items.filter((_, i) => i !== index) });
        }
    };

    const updateItem = (index: number, value: string) => {
        const items = [...block.items];
        items[index] = value;
        onChange({ ...block, items });
    };

    return (
        <BlockWrapper 
            onDelete={onDelete} 
            onMoveUp={onMoveUp} 
            onMoveDown={onMoveDown}
            isFirst={isFirst}
            isLast={isLast}
            isSelected={isSelected}
            onSelect={onSelect}
            blockType="Lijst"
            blockIcon="fa-list"
        >
            {/* List type toggle */}
            <div className="flex gap-2 mb-3">
                <button
                    onClick={() => onChange({ ...block, ordered: false })}
                    className={`px-3 py-1.5 rounded flex items-center gap-2 transition ${!block.ordered ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                    <i className="fas fa-list-ul"></i>
                    <span className="text-sm">Ongenummerd</span>
                </button>
                <button
                    onClick={() => onChange({ ...block, ordered: true })}
                    className={`px-3 py-1.5 rounded flex items-center gap-2 transition ${block.ordered ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                    <i className="fas fa-list-ol"></i>
                    <span className="text-sm">Genummerd</span>
                </button>
            </div>
            
            <div className="space-y-2">
                {block.items.map((item, index) => (
                    <div key={index} className="flex gap-2 items-center">
                        <span className="text-slate-500 text-sm w-6 text-right">
                            {block.ordered ? `${index + 1}.` : '•'}
                        </span>
                        <input
                            type="text"
                            value={item}
                            onChange={(e) => updateItem(index, e.target.value)}
                            placeholder="Lijst item..."
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500 transition text-sm"
                        />
                        <button
                            onClick={() => removeItem(index)}
                            disabled={block.items.length === 1}
                            className="p-2 text-slate-500 hover:text-red-400 disabled:opacity-30 transition"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                ))}
                
                <button
                    onClick={addItem}
                    className="w-full py-2 border border-dashed border-slate-700 rounded-lg text-slate-500 hover:text-white hover:border-slate-600 transition text-sm"
                >
                    <i className="fas fa-plus mr-2"></i>
                    Item toevoegen
                </button>
            </div>
        </BlockWrapper>
    );
};

// Quote Block Editor
export const QuoteBlockEditor: React.FC<BlockEditorProps<QuoteBlock>> = ({
    block, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast, isSelected, onSelect
}) => {
    return (
        <BlockWrapper 
            onDelete={onDelete} 
            onMoveUp={onMoveUp} 
            onMoveDown={onMoveDown}
            isFirst={isFirst}
            isLast={isLast}
            isSelected={isSelected}
            onSelect={onSelect}
            blockType="Citaat"
            blockIcon="fa-quote-left"
        >
            <div className="border-l-4 border-blue-500 pl-4 space-y-3">
                <textarea
                    value={block.content}
                    onChange={(e) => onChange({ ...block, content: e.target.value })}
                    placeholder="Citaat tekst..."
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white italic outline-none focus:border-blue-500 resize-none transition"
                />
                <input
                    type="text"
                    value={block.citation || ''}
                    onChange={(e) => onChange({ ...block, citation: e.target.value })}
                    placeholder="— Bron / Auteur"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-400 outline-none focus:border-blue-500 transition text-sm"
                />
            </div>
        </BlockWrapper>
    );
};

// Button Block Editor
export const ButtonBlockEditor: React.FC<BlockEditorProps<ButtonBlock>> = ({
    block, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast, isSelected, onSelect
}) => {
    const buttonStyles = {
        primary: 'bg-blue-600 hover:bg-blue-700 text-white',
        secondary: 'bg-slate-700 hover:bg-slate-600 text-white',
        outline: 'bg-transparent border-2 border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white'
    };

    return (
        <BlockWrapper 
            onDelete={onDelete} 
            onMoveUp={onMoveUp} 
            onMoveDown={onMoveDown}
            isFirst={isFirst}
            isLast={isLast}
            isSelected={isSelected}
            onSelect={onSelect}
            blockType="Knop"
            blockIcon="fa-mouse-pointer"
        >
            <div className="space-y-4">
                {/* Style selector */}
                <div className="flex gap-2">
                    {(['primary', 'secondary', 'outline'] as const).map(style => (
                        <button
                            key={style}
                            onClick={() => onChange({ ...block, style })}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                                block.style === style 
                                    ? buttonStyles[style] 
                                    : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                        >
                            {style === 'primary' && 'Primair'}
                            {style === 'secondary' && 'Secundair'}
                            {style === 'outline' && 'Outline'}
                        </button>
                    ))}
                </div>
                
                {/* Alignment */}
                <div className="flex gap-1">
                    {(['left', 'center', 'right'] as const).map(align => (
                        <button
                            key={align}
                            onClick={() => onChange({ ...block, alignment: align })}
                            className={`p-2 rounded transition ${block.alignment === align ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                        >
                            <i className={`fas fa-align-${align}`}></i>
                        </button>
                    ))}
                </div>
                
                {/* Text and URL */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-slate-500 mb-1 block">Knop tekst</label>
                        <input
                            type="text"
                            value={block.text}
                            onChange={(e) => onChange({ ...block, text: e.target.value })}
                            placeholder="Klik hier"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500 transition"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 mb-1 block">Link URL</label>
                        <input
                            type="url"
                            value={block.url}
                            onChange={(e) => onChange({ ...block, url: e.target.value })}
                            placeholder="https://..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500 transition"
                        />
                    </div>
                </div>
                
                {/* Preview */}
                <div className={`p-4 bg-slate-950 rounded-lg ${block.alignment === 'center' ? 'text-center' : block.alignment === 'right' ? 'text-right' : 'text-left'}`}>
                    <span className={`inline-block px-6 py-2 rounded-lg font-medium transition ${buttonStyles[block.style]}`}>
                        {block.text || 'Klik hier'}
                    </span>
                </div>
            </div>
        </BlockWrapper>
    );
};

// Divider Block Editor
export const DividerBlockEditor: React.FC<BlockEditorProps<DividerBlock>> = ({
    block, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast, isSelected, onSelect
}) => {
    return (
        <BlockWrapper 
            onDelete={onDelete} 
            onMoveUp={onMoveUp} 
            onMoveDown={onMoveDown}
            isFirst={isFirst}
            isLast={isLast}
            isSelected={isSelected}
            onSelect={onSelect}
            blockType="Scheidingslijn"
            blockIcon="fa-minus"
        >
            <div className="flex gap-2 mb-3">
                {(['solid', 'dashed', 'dotted'] as const).map(style => (
                    <button
                        key={style}
                        onClick={() => onChange({ ...block, style })}
                        className={`px-3 py-1.5 rounded text-sm transition ${block.style === style ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                    >
                        {style === 'solid' && 'Doorlopend'}
                        {style === 'dashed' && 'Gestreept'}
                        {style === 'dotted' && 'Gestippeld'}
                    </button>
                ))}
            </div>
            
            <hr className={`border-slate-600`} style={{ borderStyle: block.style }} />
        </BlockWrapper>
    );
};

// HTML Block Editor
export const HTMLBlockEditor: React.FC<BlockEditorProps<HTMLBlock>> = ({
    block, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast, isSelected, onSelect
}) => {
    const [showPreview, setShowPreview] = useState(false);

    return (
        <BlockWrapper 
            onDelete={onDelete} 
            onMoveUp={onMoveUp} 
            onMoveDown={onMoveDown}
            isFirst={isFirst}
            isLast={isLast}
            isSelected={isSelected}
            onSelect={onSelect}
            blockType="HTML"
            blockIcon="fa-code"
        >
            <div className="flex gap-2 mb-3">
                <button
                    onClick={() => setShowPreview(false)}
                    className={`px-3 py-1.5 rounded text-sm flex items-center gap-2 transition ${!showPreview ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                    <i className="fas fa-code"></i>
                    Code
                </button>
                <button
                    onClick={() => setShowPreview(true)}
                    className={`px-3 py-1.5 rounded text-sm flex items-center gap-2 transition ${showPreview ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                    <i className="fas fa-eye"></i>
                    Voorbeeld
                </button>
            </div>
            
            {showPreview ? (
                <div 
                    className="bg-slate-950 border border-slate-700 rounded-lg p-4 min-h-[100px] prose prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: block.content }}
                />
            ) : (
                <textarea
                    value={block.content}
                    onChange={(e) => onChange({ ...block, content: e.target.value })}
                    placeholder="<div>HTML code hier...</div>"
                    rows={6}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-green-400 font-mono text-sm outline-none focus:border-blue-500 resize-none transition"
                />
            )}
        </BlockWrapper>
    );
};
