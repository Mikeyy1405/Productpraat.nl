/**
 * Block Editor
 * 
 * WordPress-like block editor for creating and editing page content.
 * Provides a visual editor with drag-and-drop blocks.
 */

import React, { useState, useCallback } from 'react';
import { 
    Block, 
    BlockType, 
    BLOCK_DEFINITIONS, 
    createBlock, 
    blocksToHtml,
    htmlToBlocks,
    ParagraphBlock,
    HeadingBlock,
    ImageBlock,
    ListBlock,
    QuoteBlock,
    ButtonBlock,
    DividerBlock,
    HTMLBlock
} from './types';
import {
    ParagraphBlockEditor,
    HeadingBlockEditor,
    ImageBlockEditor,
    ListBlockEditor,
    QuoteBlockEditor,
    ButtonBlockEditor,
    DividerBlockEditor,
    HTMLBlockEditor
} from './BlockComponents';

interface BlockEditorProps {
    initialContent?: string;
    initialBlocks?: Block[];
    onChange?: (html: string, blocks: Block[]) => void;
    onSave?: (html: string, blocks: Block[]) => void;
    showPreview?: boolean;
    className?: string;
}

export const BlockEditor: React.FC<BlockEditorProps> = ({
    initialContent = '',
    initialBlocks,
    onChange,
    onSave,
    showPreview = true,
    className = ''
}) => {
    // Parse initial content to blocks if no initial blocks provided
    const [blocks, setBlocks] = useState<Block[]>(() => {
        if (initialBlocks && initialBlocks.length > 0) {
            return initialBlocks;
        }
        if (initialContent) {
            return htmlToBlocks(initialContent);
        }
        return [];
    });
    
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [isAddingBlock, setIsAddingBlock] = useState(false);
    const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');

    // Update blocks and notify parent
    const updateBlocks = useCallback((newBlocks: Block[]) => {
        setBlocks(newBlocks);
        if (onChange) {
            const html = blocksToHtml(newBlocks);
            onChange(html, newBlocks);
        }
    }, [onChange]);

    // Add a new block
    const addBlock = useCallback((type: BlockType, insertAfterIndex?: number) => {
        const newBlock = createBlock(type);
        const newBlocks = [...blocks];
        
        if (typeof insertAfterIndex === 'number') {
            newBlocks.splice(insertAfterIndex + 1, 0, newBlock);
        } else {
            newBlocks.push(newBlock);
        }
        
        updateBlocks(newBlocks);
        setSelectedBlockId(newBlock.id);
        setIsAddingBlock(false);
    }, [blocks, updateBlocks]);

    // Update a specific block
    const updateBlock = useCallback((blockId: string, updates: Partial<Block>) => {
        const newBlocks = blocks.map(block => 
            block.id === blockId ? { ...block, ...updates } as Block : block
        );
        updateBlocks(newBlocks);
    }, [blocks, updateBlocks]);

    // Delete a block
    const deleteBlock = useCallback((blockId: string) => {
        const newBlocks = blocks.filter(block => block.id !== blockId);
        updateBlocks(newBlocks);
        setSelectedBlockId(null);
    }, [blocks, updateBlocks]);

    // Move block up
    const moveBlockUp = useCallback((blockId: string) => {
        const index = blocks.findIndex(b => b.id === blockId);
        if (index > 0) {
            const newBlocks = [...blocks];
            [newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]];
            updateBlocks(newBlocks);
        }
    }, [blocks, updateBlocks]);

    // Move block down
    const moveBlockDown = useCallback((blockId: string) => {
        const index = blocks.findIndex(b => b.id === blockId);
        if (index < blocks.length - 1) {
            const newBlocks = [...blocks];
            [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
            updateBlocks(newBlocks);
        }
    }, [blocks, updateBlocks]);

    // Handle save
    const handleSave = useCallback(() => {
        if (onSave) {
            const html = blocksToHtml(blocks);
            onSave(html, blocks);
        }
    }, [blocks, onSave]);

    // Render block editor for a specific block
    const renderBlockEditor = (block: Block, index: number) => {
        const isFirst = index === 0;
        const isLast = index === blocks.length - 1;
        const isSelected = selectedBlockId === block.id;

        const commonProps = {
            onDelete: () => deleteBlock(block.id),
            onMoveUp: () => moveBlockUp(block.id),
            onMoveDown: () => moveBlockDown(block.id),
            isFirst,
            isLast,
            isSelected,
            onSelect: () => setSelectedBlockId(block.id)
        };

        switch (block.type) {
            case 'paragraph':
                return (
                    <ParagraphBlockEditor
                        key={block.id}
                        block={block as ParagraphBlock}
                        onChange={(updated) => updateBlock(block.id, updated)}
                        {...commonProps}
                    />
                );
            case 'heading':
                return (
                    <HeadingBlockEditor
                        key={block.id}
                        block={block as HeadingBlock}
                        onChange={(updated) => updateBlock(block.id, updated)}
                        {...commonProps}
                    />
                );
            case 'image':
                return (
                    <ImageBlockEditor
                        key={block.id}
                        block={block as ImageBlock}
                        onChange={(updated) => updateBlock(block.id, updated)}
                        {...commonProps}
                    />
                );
            case 'list':
                return (
                    <ListBlockEditor
                        key={block.id}
                        block={block as ListBlock}
                        onChange={(updated) => updateBlock(block.id, updated)}
                        {...commonProps}
                    />
                );
            case 'quote':
                return (
                    <QuoteBlockEditor
                        key={block.id}
                        block={block as QuoteBlock}
                        onChange={(updated) => updateBlock(block.id, updated)}
                        {...commonProps}
                    />
                );
            case 'button':
                return (
                    <ButtonBlockEditor
                        key={block.id}
                        block={block as ButtonBlock}
                        onChange={(updated) => updateBlock(block.id, updated)}
                        {...commonProps}
                    />
                );
            case 'divider':
                return (
                    <DividerBlockEditor
                        key={block.id}
                        block={block as DividerBlock}
                        onChange={(updated) => updateBlock(block.id, updated)}
                        {...commonProps}
                    />
                );
            case 'html':
                return (
                    <HTMLBlockEditor
                        key={block.id}
                        block={block as HTMLBlock}
                        onChange={(updated) => updateBlock(block.id, updated)}
                        {...commonProps}
                    />
                );
            default:
                return null;
        }
    };

    // Group block definitions by category
    const blocksByCategory = Object.values(BLOCK_DEFINITIONS).reduce((acc, block) => {
        if (!acc[block.category]) {
            acc[block.category] = [];
        }
        acc[block.category].push(block);
        return acc;
    }, {} as Record<string, typeof BLOCK_DEFINITIONS[keyof typeof BLOCK_DEFINITIONS][]>);

    const categoryLabels: Record<string, string> = {
        text: 'Tekst',
        media: 'Media',
        layout: 'Layout',
        widgets: 'Widgets'
    };

    return (
        <div className={`block-editor ${className}`}>
            {/* Editor toolbar */}
            <div className="flex items-center justify-between mb-4 bg-slate-900 border border-slate-800 rounded-xl p-3">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-slate-400">
                        <i className="fas fa-layer-group text-blue-400"></i>
                        <span className="text-sm font-medium">{blocks.length} blok{blocks.length !== 1 ? 'ken' : ''}</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    {/* View mode toggle */}
                    {showPreview && (
                        <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('edit')}
                                className={`px-3 py-1.5 rounded text-sm font-medium transition ${viewMode === 'edit' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                                <i className="fas fa-edit mr-2"></i>
                                Bewerken
                            </button>
                            <button
                                onClick={() => setViewMode('preview')}
                                className={`px-3 py-1.5 rounded text-sm font-medium transition ${viewMode === 'preview' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                                <i className="fas fa-eye mr-2"></i>
                                Voorbeeld
                            </button>
                        </div>
                    )}
                    
                    {onSave && (
                        <button
                            onClick={handleSave}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
                        >
                            <i className="fas fa-save"></i>
                            Opslaan
                        </button>
                    )}
                </div>
            </div>

            {viewMode === 'edit' ? (
                <>
                    {/* Block list */}
                    <div className="pl-14 mb-6">
                        {blocks.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-slate-700 rounded-xl">
                                <i className="fas fa-cubes text-4xl text-slate-600 mb-4"></i>
                                <h3 className="text-lg font-bold text-white mb-2">Begin met het toevoegen van blokken</h3>
                                <p className="text-slate-400 mb-4">Klik op "Blok toevoegen" om te beginnen</p>
                            </div>
                        ) : (
                            blocks.map((block, index) => renderBlockEditor(block, index))
                        )}
                    </div>

                    {/* Add block button */}
                    <div className="pl-14">
                        <button
                            onClick={() => setIsAddingBlock(!isAddingBlock)}
                            className={`w-full py-3 border-2 border-dashed rounded-xl font-medium transition flex items-center justify-center gap-2 ${
                                isAddingBlock 
                                    ? 'border-blue-500 bg-blue-500/10 text-blue-400' 
                                    : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white'
                            }`}
                        >
                            <i className={`fas ${isAddingBlock ? 'fa-times' : 'fa-plus'}`}></i>
                            {isAddingBlock ? 'Annuleren' : 'Blok toevoegen'}
                        </button>

                        {/* Block picker */}
                        {isAddingBlock && (
                            <div className="mt-4 bg-slate-900 border border-slate-800 rounded-xl p-4 animate-fade-in">
                                <h4 className="text-sm font-bold text-slate-400 mb-4">Kies een bloktype</h4>
                                
                                {Object.entries(blocksByCategory).map(([category, categoryBlocks]) => (
                                    <div key={category} className="mb-4 last:mb-0">
                                        <h5 className="text-xs text-slate-500 uppercase mb-2">{categoryLabels[category]}</h5>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                            {categoryBlocks.map(blockDef => (
                                                <button
                                                    key={blockDef.type}
                                                    onClick={() => addBlock(blockDef.type)}
                                                    className="flex flex-col items-center gap-2 p-4 bg-slate-800 hover:bg-slate-700 rounded-lg transition group"
                                                >
                                                    <div className="w-10 h-10 rounded-lg bg-slate-700 group-hover:bg-blue-600 flex items-center justify-center transition">
                                                        <i className={`fas ${blockDef.icon} text-slate-400 group-hover:text-white`}></i>
                                                    </div>
                                                    <span className="text-xs text-slate-300 font-medium">{blockDef.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                /* Preview mode */
                <div className="bg-white rounded-xl p-8 prose prose-lg max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: blocksToHtml(blocks) }} />
                </div>
            )}
        </div>
    );
};

export default BlockEditor;
