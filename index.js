const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// --- MongoDB Connection ---
const mongoURI = "mongodb+srv://shahryarsabu_db_user:7jYCAFNDGkemgYQI@cluster0.rbclxsq.mongodb.net/text?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(mongoURI)
    .then(() => console.log("✅ NAWAB-API connected to MongoDB"))
    .catch(err => console.error("❌ Database Connection Error:", err));

// --- Database Schemas ---
const BabySchema = new mongoose.Schema({
    ask: { type: String, required: true, lowercase: true },
    ans: { type: String, required: true },
    teacher: { type: String, default: "Unknown" }
});
const Baby = mongoose.model('babies', BabySchema);

const UnansweredSchema = new mongoose.Schema({
    question: { type: String, required: true, lowercase: true },
    addedAt: { type: Date, default: Date.now }
});
// Unique Index সমস্যা এড়াতে এটি ডাইনামিক রাখা হয়েছে
const Unanswered = mongoose.model('unanswered', UnansweredSchema);

// --- Gemini AI Function ---
async function getAIResponse(question) {
    try {
        const GEMINI_API_KEY = "AIzaSyCRSqp3e_s0BACEaUiLjWOLHRDFyx5tSjo"; 
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const prompt = `User question: "${question}". Answer this question in Romanized Bengali (Banglish) only. Keep it short and friendly.`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }]
        });
        return response.data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
        console.error("Gemini Error:", error.message);
        return "Ami ekhon ektu confuse, pore kotha boli?";
    }
}

// --- API Endpoints ---

// 1. Chat Response (Unanswered Save Fixed)
app.get('/api/bby', async (req, res) => {
    const text = req.query.text ? req.query.text.toLowerCase().trim() : null;
    if (!text) return res.json({ error: "Please provide text!" });

    try {
        const results = await Baby.find({ ask: text });
        
        if (results.length > 0) {
            const randomAns = results[Math.floor(Math.random() * results.length)];
            return res.json({ reply: randomAns.ans, source: "database" });
        } else {
            // ফিক্স: প্রথমে চেক করা হচ্ছে প্রশ্নটি কি অলরেডি unanswered লিস্টে আছে?
            const exist = await Unanswered.findOne({ question: text });
            if (!exist) {
                await Unanswered.create({ question: text });
                console.log(`📌 New unanswered question saved: ${text}`);
            }

            const aiReply = await getAIResponse(text);
            res.json({ reply: aiReply, source: "Gemini AI" });
        }
    } catch (dbError) {
        console.error("Database Error in /api/bby:", dbError.message);
        const aiReply = await getAIResponse(text);
        res.json({ reply: aiReply, source: "Gemini AI (DB Error)" });
    }
});

// 2. Teach (New logic: delete from unanswered)
app.get('/api/bby/teach', async (req, res) => {
    const { ask, ans, teacher } = req.query;
    if (!ask || !ans) return res.json({ error: "Provide both 'ask' and 'ans'!" });

    try {
        const askText = ask.toLowerCase().trim();
        await Baby.create({ 
            ask: askText, 
            ans: ans.trim(), 
            teacher: teacher || "Unknown" 
        });

        // প্রশ্ন শেখানো শেষ, তাই লিস্ট থেকে মুছে দিন
        await Unanswered.deleteMany({ question: askText });

        res.json({ status: "success", message: "Teach successful!" });
    } catch (err) {
        res.json({ status: "error", message: err.message });
    }
});

// বাকি সব এন্ডপয়েন্ট (total, list, top, questions, remove) আগের মতই থাকবে...
app.get('/api/bby/total', async (req, res) => {
    const count = await Baby.countDocuments();
    res.json({ total_commands: count });
});

app.get('/api/bby/list', async (req, res) => {
    const list = await Baby.aggregate([
        { $group: { _id: "$teacher", count: { $sum: 1 } } },
        { $project: { teacher_name: "$_id", teach_count: "$count", _id: 0 } }
    ]);
    res.json({ teachers: list });
});

app.get('/api/bby/top', async (req, res) => {
    const top = await Baby.aggregate([
        { $group: { _id: "$teacher", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { teacher_name: "$_id", teach_count: "$count", _id: 0 } }
    ]);
    res.json({ top_10_teachers: top });
});

app.get('/api/bby/questions', async (req, res) => {
    const type = req.query.type;
    try {
        if (type === 'repeat') {
            const count = await Baby.countDocuments();
            if (count === 0) return res.json({ question: "Kemon acho?" });
            const random = Math.floor(Math.random() * count);
            const entry = await Baby.findOne().skip(random);
            res.json({ question: entry.ask });
        } else {
            const count = await Unanswered.countDocuments();
            if (count === 0) {
                const bCount = await Baby.countDocuments();
                if (bCount === 0) return res.json({ question: "Kemon acho?" });
                const bRandom = Math.floor(Math.random() * bCount);
                const bEntry = await Baby.findOne().skip(bRandom);
                return res.json({ question: bEntry.ask });
            }
            const random = Math.floor(Math.random() * count);
            const entry = await Unanswered.findOne().skip(random);
            res.json({ question: entry.question });
        }
    } catch (err) { res.json({ error: "Error fetching questions" }); }
});

app.get('/api/bby/remove', async (req, res) => {
    const { ask, ans } = req.query;
    try {
        await Baby.deleteOne({ ask: ask.toLowerCase().trim(), ans: ans.trim() });
        res.json({ status: "success" });
    } catch (err) { res.json({ status: "error" }); }
});

app.get('/', (req, res) => res.json({ status: "running" }));

app.listen(PORT, () => console.log(`🚀 NAWAB-API on port ${PORT}`));
    
