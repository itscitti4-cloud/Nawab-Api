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
    question: { type: String, required: true, lowercase: true, unique: true },
    addedAt: { type: Date, default: Date.now }
});
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
        return "Ami ekhon ektu confuse, pore kotha boli?";
    }
}

// --- API Endpoints ---

// 1. Chat Response (Fixed Auto-Save Logic)
app.get('/api/bby', async (req, res) => {
    const text = req.query.text ? req.query.text.toLowerCase().trim() : null;
    if (!text) return res.json({ error: "Please provide text!" });

    const results = await Baby.find({ ask: text });
    
    if (results.length > 0) {
        const randomAns = results[Math.floor(Math.random() * results.length)];
        return res.json({ reply: randomAns.ans, source: "database" });
    } else {
        // লজিক আপডেট: AI উত্তরের জন্য অপেক্ষা করার আগেই প্রশ্নটি Unanswered-এ সেভ করা হচ্ছে
        try {
            await Unanswered.findOneAndUpdate(
                { question: text },
                { question: text },
                { upsert: true, new: true }
            );
        } catch (e) { console.log("Save error:", e.message); }

        const aiReply = await getAIResponse(text);
        res.json({ reply: aiReply, source: "Gemini AI" });
    }
});

// 2. Teach
app.get('/api/bby/teach', async (req, res) => {
    const { ask, ans, teacher } = req.query;
    if (!ask || !ans) return res.json({ error: "Provide both 'ask' and 'ans'!" });

    try {
        const askText = ask.toLowerCase().trim();
        const newData = new Baby({ 
            ask: askText, 
            ans: ans.trim(), 
            teacher: teacher || "Unknown" 
        });
        await newData.save();

        // প্রশ্নটি শেখানো হয়ে গেলে unanswered লিস্ট থেকে ডিলিট করে দিবে
        await Unanswered.deleteOne({ question: askText });

        res.json({ status: "success", message: "Teach successful!" });
    } catch (err) {
        res.json({ status: "error", message: err.message });
    }
});

// 3. Remove
app.get('/api/bby/remove', async (req, res) => {
    const { ask, ans } = req.query;
    if (!ask || !ans) return res.json({ status: "failed" });

    try {
        await Baby.deleteOne({ ask: ask.toLowerCase().trim(), ans: ans.trim() });
        res.json({ status: "success" });
    } catch (err) { res.json({ status: "error" }); }
});

// 4. Total Entries
app.get('/api/bby/total', async (req, res) => {
    const count = await Baby.countDocuments();
    res.json({ total_commands: count });
});

// 5. List
app.get('/api/bby/list', async (req, res) => {
    const list = await Baby.aggregate([
        { $group: { _id: "$teacher", count: { $sum: 1 } } },
        { $project: { teacher_name: "$_id", teach_count: "$count", _id: 0 } }
    ]);
    res.json({ teachers: list });
});

// 6. Top 10
app.get('/api/bby/top', async (req, res) => {
    const top = await Baby.aggregate([
        { $group: { _id: "$teacher", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { teacher_name: "$_id", teach_count: "$count", _id: 0 } }
    ]);
    res.json({ top_10_teachers: top });
});

// 7. Get Questions (For !nt)
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
                // কোনো নতুন প্রশ্ন না থাকলে ডাটাবেজ থেকে র্যান্ডম দিবে
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

app.get('/', (req, res) => res.json({ status: "running" }));

app.listen(PORT, () => console.log(`🚀 NAWAB-API on port ${PORT}`));
                           
