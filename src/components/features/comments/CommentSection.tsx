/**
 * Comments Components
 * 
 * Comment section with nested/threaded comments support.
 * Only renders when the 'comments' feature is enabled.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useFeature, useFeatureToggle, useTemplate } from '../../../cms';

export interface Comment {
    id: string;
    parentId?: string;
    contentId: string; // ID of the article/product being commented on
    author: string;
    email: string;
    content: string;
    createdAt: string;
    upvotes: number;
    downvotes: number;
    isApproved: boolean;
}

const STORAGE_KEY = 'writgo_comments_data';
const USER_VOTES_KEY = 'writgo_comment_votes';

// Load comments from localStorage
export const loadComments = (): Comment[] => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

// Save comments to localStorage
export const saveComments = (comments: Comment[]): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(comments));
};

// Get user votes
const getUserVotes = (): Record<string, 'up' | 'down'> => {
    try {
        const data = localStorage.getItem(USER_VOTES_KEY);
        return data ? JSON.parse(data) : {};
    } catch {
        return {};
    }
};

// Save user vote
const saveUserVote = (commentId: string, vote: 'up' | 'down' | null): void => {
    const votes = getUserVotes();
    if (vote === null) {
        delete votes[commentId];
    } else {
        votes[commentId] = vote;
    }
    localStorage.setItem(USER_VOTES_KEY, JSON.stringify(votes));
};

interface CommentFormProps {
    contentId: string;
    parentId?: string;
    onSubmit: (comment: Omit<Comment, 'id' | 'createdAt' | 'upvotes' | 'downvotes' | 'isApproved'>) => void;
    onCancel?: () => void;
    isReply?: boolean;
}

export const CommentForm: React.FC<CommentFormProps> = ({
    contentId,
    parentId,
    onSubmit,
    onCancel,
    isReply = false
}) => {
    const [formData, setFormData] = useState({
        author: '',
        email: '',
        content: ''
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        
        if (!formData.author.trim()) {
            newErrors.author = 'Naam is verplicht';
        }
        
        if (!formData.email.trim()) {
            newErrors.email = 'E-mail is verplicht';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Ongeldig e-mailadres';
        }
        
        if (!formData.content.trim()) {
            newErrors.content = 'Reactie is verplicht';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validate()) return;
        
        setIsSubmitting(true);
        
        onSubmit({
            contentId,
            parentId,
            author: formData.author.trim(),
            email: formData.email.trim(),
            content: formData.content.trim()
        });
        
        setFormData({ author: '', email: '', content: '' });
        setIsSubmitting(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {!isReply && (
                <h3 className="text-lg font-bold text-white">Plaats een reactie</h3>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <input
                        type="text"
                        value={formData.author}
                        onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                        placeholder="Je naam *"
                        className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none transition ${
                            errors.author ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'
                        }`}
                    />
                    {errors.author && <p className="mt-1 text-sm text-red-400">{errors.author}</p>}
                </div>
                
                <div>
                    <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="Je e-mail *"
                        className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none transition ${
                            errors.email ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'
                        }`}
                    />
                    {errors.email && <p className="mt-1 text-sm text-red-400">{errors.email}</p>}
                </div>
            </div>
            
            <div>
                <textarea
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Je reactie *"
                    rows={isReply ? 3 : 4}
                    className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none transition resize-none ${
                        errors.content ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'
                    }`}
                />
                {errors.content && <p className="mt-1 text-sm text-red-400">{errors.content}</p>}
            </div>
            
            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white font-bold px-6 py-2 rounded-xl transition flex items-center gap-2"
                >
                    {isSubmitting ? (
                        <i className="fas fa-spinner fa-spin"></i>
                    ) : (
                        <>
                            <i className="fas fa-paper-plane"></i>
                            {isReply ? 'Reageer' : 'Plaats reactie'}
                        </>
                    )}
                </button>
                
                {isReply && onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-400 px-4 py-2 rounded-xl transition"
                    >
                        Annuleren
                    </button>
                )}
            </div>
        </form>
    );
};

interface CommentItemProps {
    comment: Comment;
    replies: Comment[];
    allComments: Comment[];
    depth: number;
    maxDepth: number;
    allowVoting: boolean;
    onVote: (commentId: string, vote: 'up' | 'down') => void;
    onReply: (parentId: string) => void;
    replyingTo: string | null;
    onSubmitReply: (comment: Omit<Comment, 'id' | 'createdAt' | 'upvotes' | 'downvotes' | 'isApproved'>) => void;
    onCancelReply: () => void;
    contentId: string;
}

const CommentItem: React.FC<CommentItemProps> = ({
    comment,
    replies,
    allComments,
    depth,
    maxDepth,
    allowVoting,
    onVote,
    onReply,
    replyingTo,
    onSubmitReply,
    onCancelReply,
    contentId
}) => {
    const userVotes = getUserVotes();
    const userVote = userVotes[comment.id];
    
    const getNestedReplies = (parentId: string): Comment[] => {
        return allComments.filter(c => c.parentId === parentId);
    };

    return (
        <div className={`${depth > 0 ? 'ml-6 md:ml-12 pl-4 border-l-2 border-slate-800' : ''}`}>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-3">
                {/* Header */}
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                        <span className="text-white font-bold">
                            {comment.author.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <div>
                        <div className="font-bold text-white">{comment.author}</div>
                        <div className="text-xs text-slate-500">
                            {new Date(comment.createdAt).toLocaleDateString('nl-NL', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </div>
                    </div>
                </div>
                
                {/* Content */}
                <p className="text-slate-300 mb-3 whitespace-pre-wrap">{comment.content}</p>
                
                {/* Actions */}
                <div className="flex items-center gap-4 text-sm">
                    {allowVoting && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => onVote(comment.id, 'up')}
                                className={`flex items-center gap-1 px-2 py-1 rounded transition ${
                                    userVote === 'up' 
                                        ? 'bg-green-600/20 text-green-400' 
                                        : 'hover:bg-slate-800 text-slate-500 hover:text-green-400'
                                }`}
                            >
                                <i className="fas fa-thumbs-up"></i>
                                <span>{comment.upvotes}</span>
                            </button>
                            <button
                                onClick={() => onVote(comment.id, 'down')}
                                className={`flex items-center gap-1 px-2 py-1 rounded transition ${
                                    userVote === 'down' 
                                        ? 'bg-red-600/20 text-red-400' 
                                        : 'hover:bg-slate-800 text-slate-500 hover:text-red-400'
                                }`}
                            >
                                <i className="fas fa-thumbs-down"></i>
                                <span>{comment.downvotes}</span>
                            </button>
                        </div>
                    )}
                    
                    {depth < maxDepth && (
                        <button
                            onClick={() => onReply(comment.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 text-slate-500 hover:text-blue-400 transition"
                        >
                            <i className="fas fa-reply"></i>
                            <span>Reageer</span>
                        </button>
                    )}
                </div>
                
                {/* Reply form */}
                {replyingTo === comment.id && (
                    <div className="mt-4 pt-4 border-t border-slate-800">
                        <CommentForm
                            contentId={contentId}
                            parentId={comment.id}
                            onSubmit={onSubmitReply}
                            onCancel={onCancelReply}
                            isReply
                        />
                    </div>
                )}
            </div>
            
            {/* Nested replies */}
            {replies.map(reply => (
                <CommentItem
                    key={reply.id}
                    comment={reply}
                    replies={getNestedReplies(reply.id)}
                    allComments={allComments}
                    depth={depth + 1}
                    maxDepth={maxDepth}
                    allowVoting={allowVoting}
                    onVote={onVote}
                    onReply={onReply}
                    replyingTo={replyingTo}
                    onSubmitReply={onSubmitReply}
                    onCancelReply={onCancelReply}
                    contentId={contentId}
                />
            ))}
        </div>
    );
};

interface CommentSectionProps {
    contentId: string;
    title?: string;
    className?: string;
}

export const CommentSection: React.FC<CommentSectionProps> = ({
    contentId,
    title = 'Reacties',
    className = ''
}) => {
    const enabled = useFeature('comments');
    const { settings } = useFeatureToggle('comments');
    const { type: templateType } = useTemplate();
    
    const [allComments, setAllComments] = useState<Comment[]>(() => loadComments());
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'popular'>('newest');

    const maxNestingLevel = (settings?.maxNestingLevel as number) || 3;
    const allowVoting = settings?.allowVoting !== false;

    // Filter comments for this content
    const contentComments = useMemo(() => {
        return allComments.filter(c => c.contentId === contentId && c.isApproved);
    }, [allComments, contentId]);

    // Get top-level comments (no parent)
    const topLevelComments = useMemo(() => {
        let comments = contentComments.filter(c => !c.parentId);
        
        switch (sortBy) {
            case 'oldest':
                comments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                break;
            case 'popular':
                comments.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
                break;
            case 'newest':
            default:
                comments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                break;
        }
        
        return comments;
    }, [contentComments, sortBy]);

    const getReplies = useCallback((parentId: string): Comment[] => {
        return contentComments.filter(c => c.parentId === parentId);
    }, [contentComments]);

    const handleAddComment = useCallback((commentData: Omit<Comment, 'id' | 'createdAt' | 'upvotes' | 'downvotes' | 'isApproved'>) => {
        const newComment: Comment = {
            ...commentData,
            id: `comment-${Date.now()}`,
            createdAt: new Date().toISOString(),
            upvotes: 0,
            downvotes: 0,
            isApproved: true // Auto-approve for now, could be moderated
        };
        
        const updatedComments = [...allComments, newComment];
        setAllComments(updatedComments);
        saveComments(updatedComments);
        setReplyingTo(null);
    }, [allComments]);

    const handleVote = useCallback((commentId: string, vote: 'up' | 'down') => {
        const userVotes = getUserVotes();
        const currentVote = userVotes[commentId];
        
        setAllComments(prev => {
            const updated = prev.map(c => {
                if (c.id !== commentId) return c;
                
                let upvotes = c.upvotes;
                let downvotes = c.downvotes;
                
                // Remove previous vote if exists
                if (currentVote === 'up') upvotes--;
                if (currentVote === 'down') downvotes--;
                
                // Add new vote (unless clicking same button = remove vote)
                if (currentVote !== vote) {
                    if (vote === 'up') upvotes++;
                    if (vote === 'down') downvotes++;
                    saveUserVote(commentId, vote);
                } else {
                    saveUserVote(commentId, null);
                }
                
                return { ...c, upvotes, downvotes };
            });
            
            saveComments(updated);
            return updated;
        });
    }, []);

    if (!enabled) return null;

    return (
        <div className={`${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <i className="fas fa-comments text-blue-500"></i>
                    {title} ({contentComments.length})
                </h2>
                
                {contentComments.length > 1 && (
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 cursor-pointer"
                    >
                        <option value="newest">Nieuwste eerst</option>
                        <option value="oldest">Oudste eerst</option>
                        {allowVoting && <option value="popular">Populairst</option>}
                    </select>
                )}
            </div>

            {/* Comment form */}
            <div className="mb-8 bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                <CommentForm 
                    contentId={contentId} 
                    onSubmit={handleAddComment} 
                />
            </div>

            {/* Comments list */}
            {topLevelComments.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
                    <i className="fas fa-comment-slash text-4xl text-slate-600 mb-4"></i>
                    <h3 className="text-lg font-bold text-white mb-2">Nog geen reacties</h3>
                    <p className="text-slate-400">Wees de eerste om te reageren!</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {topLevelComments.map(comment => (
                        <CommentItem
                            key={comment.id}
                            comment={comment}
                            replies={getReplies(comment.id)}
                            allComments={contentComments}
                            depth={0}
                            maxDepth={maxNestingLevel}
                            allowVoting={allowVoting}
                            onVote={handleVote}
                            onReply={setReplyingTo}
                            replyingTo={replyingTo}
                            onSubmitReply={handleAddComment}
                            onCancelReply={() => setReplyingTo(null)}
                            contentId={contentId}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default CommentSection;
