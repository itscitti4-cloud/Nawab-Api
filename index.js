const express = require('express');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

// --- MongoDB Connection ---
// ডাটাবেজ নাম 'text' নিশ্চিত করা হয়েছে
const mongoURI = "mongodb+srv://shahryarsabu_db_user:7jYCAFNDGkemgYQI@cluster0.rbclxsq.mongodb.net/text?retryWrites=true&w=majority";

mongoose.connect(mongoURI)
    .then(() => console.log("✅ NAWAB-API connected to MongoDB (Database: text)"))
    .catch(err => console.error("❌ Database Connection Error:", err));

// --- Database Models ---
const Baby = mongoose.model('babies', new mongoose.Schema({
    ask: { type: String, required: true, lowercase: true },
    ans: { type: String, required: true },
    teacher: { type: String, default: "Unknown" }
}));

const Unanswered = mongoose.model('unanswered', new mongoose.Schema({
    question: { type: String, required: true, lowercase: true },
    addedAt: { type: Date, default: Date.now }
}), 'unanswered');

// --- API Endpoints ---

app.get('/api/bby', async (req, res) => {
    const text = req.query.text ? req.query.text.toLowerCase().trim() : null;
    if (!text) return res.json({ error: "Please provide text!" });

    try {
        // ১. ডাটাবেজে উত্তর খুঁজুন
        const result = await Baby.findOne({ ask: text });
        
        if (result) {
            return res.json({ reply: result.ans, source: "database" });
        } else {
            // ২. উত্তর না থাকলে Unanswered-এ সেভ করুন
            const exist = await Unanswered.findOne({ question: text });
            if (!exist) {
                await Unanswered.create({ question: text });
                console.log(`💾 New question saved to unanswered list: ${text}`);
            }
            
            // ৩. Gemini বাদ, এখন সরাসরি একটি ডিফল্ট মেসেজ দিবে
            return res.json({ 
                reply: "Ei proshnotar uttor amar jana nei, ektu shikhiye dibe? (Use !teach command)", 
                source: "unanswered_logger" 
            });
        }
    } catch (err) {
        console.error("API Error:", err.message);
        res.json({ reply: "Database connection e shomosha hocche!", error: err.message });
    }
});

// --- Teach Endpoint (নতুন উত্তর শিখলে unanswered থেকে ডিলিট হবে) ---
app.get('/api/bby/teach', async (req, res) => {
    const { ask, ans, teacher } = req.query;
    if (!ask || !ans) return res.json({ error: "Ask and Ans required!" });

    try {
        const askText = ask.toLowerCase().trim();
        await Baby.create({ ask: askText, ans: ans.trim(), teacher: teacher || "Unknown" });
        
        // শেখানো হয়ে গেলে unanswered থেকে মুছে ফেলুন
        await Unanswered.deleteMany({ question: askText });
        
        res.json({ status: "success", message: "Shikhlam! Ekhon theke parbo." });
    } catch (err) {
        res.json({ status: "error", message: err.message });
    }
});

// --- Unanswered Questions List (nt.js এর জন্য) ---
app.get('/api/bby/questions', async (req, res) => {
    try {
        const count = await Unanswered.countDocuments();
        if (count === 0) {
            const bCount = await Baby.countDocuments();
            const random = Math.floor(Math.random() * bCount);
            const entry = await Baby.findOne().skip(random);
            return res.json({ question: entry ? entry.ask : "Kemon acho?" });
        }
        const random = Math.floor(Math.random() * count);
        const entry = await Unanswered.findOne().skip(random);
        res.json({ question: entry.question });
    } catch (err) {
        res.json({ error: "Error fetching questions" });
    }
});

app.get('/', (req, res) => res.json({ status: "running", mode: "clean_learning" }));

app.listen(PORT, () => console.log(`🚀 NAWAB-API (No AI Mode) running on port ${PORT}`));
