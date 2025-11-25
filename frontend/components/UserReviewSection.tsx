
import React, { useState, useEffect } from 'react';
import { UserReview } from '../types';
import { db } from '../services/storage';

interface UserReviewSectionProps {
    productId: string;
}

export const UserReviewSection: React.FC<UserReviewSectionProps> = ({ productId }) => {
    const [reviews, setReviews] = useState<UserReview[]>([]);
    const [name, setName] = useState('');
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        db.getReviewsForProduct(productId).then(setReviews);
    }, [productId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !comment.trim()) return;

        setIsSubmitting(true);
        
        const newReview: UserReview = {
            id: `rev-${Date.now()}`,
            productId,
            userName: name,
            rating,
            comment,
            date: new Date().toLocaleDateString('nl-NL', { year: 'numeric', month: 'long', day: 'numeric' })
        };

        const updatedList = await db.addUserReview(newReview);
        setReviews(updatedList);
        
        setName('');
        setComment('');
        setRating(5);
        setIsSubmitting(false);
    };

    const renderStars = (count: number) => (
        <div className="flex gap-1 text-orange-400 text-xs">
            {Array.from({ length: 5 }).map((_, i) => (
                <i key={i} className={`fas fa-star ${i < count ? '' : 'text-slate-700'}`}></i>
            ))}
        </div>
    );

    return (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-lg overflow-hidden mt-8">
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-sm shadow-sm"><i className="fas fa-comment-dots"></i></div>
                    <h3 className="font-bold text-white">Community Reviews</h3>
                </div>
                <span className="bg-white/10 text-white text-xs px-3 py-1 rounded-full font-medium">{reviews.length} ervaringen</span>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                    {reviews.length === 0 ? (
                        <div className="text-center py-10 bg-slate-900 rounded-xl border border-dashed border-slate-700">
                            <i className="fas fa-pen-fancy text-slate-600 text-3xl mb-3"></i>
                            <p className="text-slate-400 font-medium">Wees de eerste die een review schrijft!</p>
                        </div>
                    ) : (
                        <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scroll pr-2">
                            {reviews.map(review => (
                                <div key={review.id} className="border-b border-slate-800 pb-4 last:border-0 last:pb-0">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-slate-800 text-[#1877F2] flex items-center justify-center text-xs font-bold uppercase border border-slate-700">{review.userName.charAt(0)}</div>
                                            <div><div className="text-sm font-bold text-slate-200">{review.userName}</div><div className="text-[10px] text-slate-500">{review.date}</div></div>
                                        </div>
                                        {renderStars(review.rating)}
                                    </div>
                                    <p className="text-sm text-slate-400 leading-relaxed bg-slate-800 p-3 rounded-lg rounded-tl-none">"{review.comment}"</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 h-fit">
                    <h4 className="font-bold text-white mb-4">Deel jouw ervaring</h4>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Jouw cijfer</label>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button key={star} type="button" onClick={() => setRating(star)} className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition ${rating >= star ? 'bg-orange-500 text-white shadow-sm' : 'bg-slate-900 text-slate-600 border border-slate-700 hover:border-orange-500/50'}`}><i className="fas fa-star"></i></button>
                                ))}
                            </div>
                        </div>
                        <div><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Naam</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-blue-500 outline-none text-sm" required /></div>
                        <div><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Jouw ervaring</label><textarea value={comment} onChange={(e) => setComment(e.target.value)} className="w-full h-32 px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 text-white focus:border-blue-500 outline-none text-sm resize-none" required></textarea></div>
                        <button type="submit" disabled={isSubmitting} className="w-full bg-[#1877F2] hover:bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg transition">{isSubmitting ? 'Versturen...' : 'Plaats Review'}</button>
                    </form>
                </div>
            </div>
        </div>
    );
};
