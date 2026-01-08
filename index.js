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

// --- Database Schemas & Models ---

// কালেকশনের নাম 'babies' এবং 'unanswereds' হিসেবে অটো তৈরি হবে
const Baby = mongoose.model('babies', new mongoose.Schema({
    ask: { type: String, required: true, lowercase: true },
    ans: { type: String, required: true },
    teacher: { type: String, default: "Unknown" }
}));

// এখানে কালেকশনের নাম স্পষ্টভাবে 'unanswered' বলে দেওয়া হয়েছে
const Unanswered = mongoose.model('unanswered', new mongoose.Schema({
    question: { type: String, required: true, lowercase: true },
    addedAt: { type: Date, default: Date.now }
}), 'unanswered'); // এই ৩য় প্যারামিটারটি কালেকশন ফোল্ডার তৈরি নিশ্চিত করবে

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
        return "Ami ekhon ektu confuse, pore kotha boli?";
    }
}

// --- API Endpoints ---

app.get('/api/bby', async (req, res) => {
    const text = req.query.text ? req.query.text.toLowerCase().trim() : null;
    if (!text) return res.json({ error: "Please provide text!" });

    try {
        const result = await Baby.findOne({ ask: text });
        
        if (result) {
            return res.json({ reply: result.ans, source: "database" });
        } else {
            // ডাটাবেজে না থাকলে Unanswered কালেকশনে সেইভ হবে
            const exist = await Unanswered.findOne({ question: text });
            if (!exist) {
                const newUnanswered = new Unanswered({ question: text });
                await newUnanswered.save();
                console.log(`📌 Unanswered Saved: ${text}`);
            }

            const aiReply = await getAIResponse(text);
            res.json({ reply: aiReply, source: "Gemini AI" });
        }
    } catch (dbError) {
        const aiReply = await getAIResponse(text);
        res.json({ reply: aiReply, source: "AI (Error fallback)" });
    }
});

app.get('/api/bby/teach', async (req, res) => {
    const { ask, ans, teacher } = req.query;
    if (!ask || !ans) return res.json({ error: "Missing data" });

    try {
        const askText = ask.toLowerCase().trim();
        await Baby.create({ ask: askText, ans: ans.trim(), teacher: teacher || "Unknown" });
        await Unanswered.deleteMany({ question: askText });
        res.json({ status: "success" });
    } catch (err) { res.json({ status: "error" }); }
});

app.get('/api/bby/questions', async (req, res) => {
    const type = req.query.type;
    try {
        if (type === 'repeat') {
            const count = await Baby.countDocuments();
            const random = Math.floor(Math.random() * count);
            const entry = await Baby.findOne().skip(random);
            res.json({ question: entry ? entry.ask : "Kemon acho?" });
        } else {
            const count = await Unanswered.countDocuments();
            if (count === 0) {
                const bCount = await Baby.countDocuments();
                const bRandom = Math.floor(Math.random() * bCount);
                const bEntry = await Baby.findOne().skip(bRandom);
                return res.json({ question: bEntry ? bEntry.ask : "Kemon acho?" });
            }
            const random = Math.floor(Math.random() * count);
            const entry = await Unanswered.findOne().skip(random);
            res.json({ question: entry.question });
        }
    } catch (err) { res.json({ error: "Error" }); }
});

// অন্যান্য এন্ডপয়েন্ট (total, list, top, remove) আগের মতোই থাকবে...
app.get('/api/bby/total', async (req, res) => res.json({ total_commands: await Baby.countDocuments() }));

app.get('/', (req, res) => res.json({ status: "running" }));
app.listen(PORT, () => console.log(`🚀 API on port ${PORT}`));
